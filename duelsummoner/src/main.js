// Duel Summoner, browser entry. Wires the simulation to the view and the UI modes: start, play, pause, offer, results.
import { CFG } from './data/config.js';
import { Game } from './sim/game.js';
import { Input } from './core/input.js';
import { clock } from './core/util.js';
import { buildMapMesh } from './view/mapMesh.js';
import { Actors } from './view/actors.js';
import { ChaseCamera } from './view/camera.js';
import { Minimap } from './view/minimap.js';
import { drawHud, showFlash, showBanner } from './view/hud.js';
import { showOffer, offerKey } from './view/offer.js';
import { loadModel, loadPuffTexture } from './view/models.js';
import { spawnEnemy } from './sim/enemies.js';
import { Props } from './view/props.js';
import { loadSave, recordRun } from './core/save.js';

const T = window.THREE, $ = id => document.getElementById(id);
const canvas = $('view');
const renderer = new T.WebGLRenderer({ canvas, antialias: false });
const LOW = 2;                                   // render at half size for a chunky look
const scene = new T.Scene();
scene.background = new T.Color(0xe6cb97);                // warm daylight sand sky
scene.fog = new T.Fog(0xe6cb97, 110, 330);
const camera = new T.PerspectiveCamera(62, 1, 0.1, 520);
scene.add(new T.HemisphereLight(0xfff3d6, 0x8a6a48, 0.95));     // raised from the dark build: the arena reads in daylight sand colours
scene.add(new T.AmbientLight(0xffffff, 0.12));
const sun = new T.DirectionalLight(0xffe2b0, 0.6); sun.position.set(60, 90, 30); scene.add(sun);

function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setPixelRatio(1); renderer.setSize(Math.ceil(w / LOW), Math.ceil(h / LOW), false);
  camera.aspect = w / h; camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize); resize();

// the owner's models are optional local assets; the placeholders stay if they are missing
const assets = { wyvern: await loadModel('assets/models/ember-wyvern.ewv.b64'), hatchling: await loadModel('assets/models/cinder-hatchling.ewv.b64') };
if (assets.hatchling) assets.puff = await loadPuffTexture('assets/models/puff.png.b64');

scene.add(buildMapMesh());
let duelist = 'kael';
const withProps = /[?&]props/.test(location.search);       // map objects are placed by the coming map generator; ?props shows the region-placed test set
const game = new Game(Date.now() & 0xffff, { duelist, world: withProps ? 'regions' : 'none' });
const actors = new Actors(scene, assets);
const props = new Props(scene);
const chase = new ChaseCamera(camera);
const input = new Input(canvas);
const minimap = new Minimap($('minimap'));

let MODE = 'start', last = 0, frozen = false;
const save = loadSave();

function lock() { if (canvas.requestPointerLock) { try { canvas.requestPointerLock(); } catch (e) {} } }
function setMode(m) {
  MODE = m; input.enabled = m === 'play';
  for (const [id, mm] of [['startScreen', 'start'], ['pauseScreen', 'pause'], ['deadScreen', 'dead'], ['offerScreen', 'offer']]) $(id).classList.toggle('on', m === mm);
  if (m !== 'play' && document.pointerLockElement && document.exitPointerLock) document.exitPointerLock();
  $('hint').textContent = m === 'play' && !document.pointerLockElement ? 'Click the map to look around' : '';
  last = 0;
}
function begin() {
  ended = false; game.reset(Date.now() & 0xffff, duelist); game.acc = 0; input.yaw = 0; input.pitch = 0; chase.reset(); input.keys = {};
  for (const m of actors.monsters.values()) scene.remove(m); actors.monsters.clear();
  for (const m of actors.specials.values()) scene.remove(m); actors.specials.clear();
  for (const m of actors.chests.values()) scene.remove(m); actors.chests.clear();
  drawHud(game, true); setMode('play'); lock();
}
function pickDuelist(id) { duelist = id; $('pickKael').classList.toggle('sel', id === 'kael'); $('pickMira').classList.toggle('sel', id === 'mira'); }
$('pickKael').addEventListener('click', () => pickDuelist('kael'));
$('pickMira').addEventListener('click', () => pickDuelist('mira'));
$('startBtn').addEventListener('click', begin);
$('restartBtn').addEventListener('click', begin);
$('endBtn').addEventListener('click', () => { game.endRun(); results(); });
$('resumeBtn').addEventListener('click', () => { setMode('play'); lock(); });
canvas.addEventListener('mousedown', () => { if (MODE === 'play') lock(); });
document.addEventListener('pointerlockchange', () => {
  if (!document.pointerLockElement && MODE === 'play') setMode('pause');
  else if (MODE === 'play') $('hint').textContent = '';
});
window.addEventListener('keydown', e => {
  if (e.code === 'Escape' && MODE === 'play' && !document.pointerLockElement) setMode('pause');
  if (MODE === 'offer' && !e.repeat && offerKey(game, e.code)) afterOfferChange();
});
window.addEventListener('blur', () => { if (MODE === 'play') setMode('pause'); });
document.addEventListener('visibilitychange', () => { if (document.hidden && MODE === 'play') setMode('pause'); });

function afterOfferChange() {
  if (game.offer) showOffer(game, afterOfferChange);       // redraw / banish: same screen, new cards
  else { setMode('play'); lock(); drawHud(game, true); }
}
let ended = false;
function results() {
  let info = { record: { bestTime: 0 }, newBest: false };
  if (!ended) { ended = true; info = recordRun(save, duelist, { time: game.t, kills: game.kills, level: game.level, bossKilled: game.bossKilled, chips: game.starChips() }); }   // saved once per run
  $('resTitle').textContent = game.bossKilled ? 'VICTORY' : game.ended ? 'RUN ENDED' : 'DEFEATED';
  $('dTime').textContent = clock(game.t); $('dLevel').textContent = game.level; $('dKills').textContent = game.kills; $('dFusions').textContent = game.fusions;
  $('dOvertime').textContent = clock(game.overtimeSeconds()); $('dChips').textContent = game.starChips(); $('dBest').textContent = clock(save.records[duelist] ? save.records[duelist].bestTime : 0) + (info.newBest ? '  NEW BEST' : '');
  const why = game.bossKilled ? 'The Hollow Pharaoh fell. Overtime goes on until you fall.' : game.ended ? 'You ended the run.' : 'Downed by ' + (game.killedBy || 'the horde');
  $('dCause').textContent = why;
  const top = Object.entries(game.damageBy).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, v]) => k + ' ' + Math.round(v)).join('  /  ');
  $('dBreakdown').textContent = top ? 'Damage taken: ' + top : '';
  drawHud(game, true); setMode('dead');
}
function drainEvents() {
  for (const ev of game.events) {
    if (ev.type === 'banner') showBanner(ev.data);
    else if (ev.type === 'offer') { setMode('offer'); showOffer(game, afterOfferChange); }
    else if (ev.type === 'levelup') showBanner('Level ' + ev.data);
  }
  game.events.length = 0;
}

const dbg = $('debug'), showDebug = /[?&]debug/.test(location.search);
dbg.style.display = showDebug ? 'block' : 'none';
let fpsFrames = 0, fpsT = 0, stepMs = 0;
const perf = { frames: 0, t0: 0, worst: 0, lastNow: 0 };
const head = { x: 0, y: 0, z: 0 }, ip = { x: 0, y: 0, z: 0 }, prof = { sim: 0, view: 0, render: 0 };

function frame(now) {
  requestAnimationFrame(frame);
  const dtReal = last ? Math.min(0.1, (now - last) / 1000) : 0;
  let alpha = game.alpha;
  if (MODE === 'play') {
    last = now;
    const s0 = performance.now();
    if (dtReal > 0 && !frozen) alpha = game.fixed(dtReal, input.command());
    prof.sim = performance.now() - s0; stepMs += prof.sim;
    drainEvents();
    if (game.over && MODE === 'play') results();
    if (MODE === 'play') drawHud(game, false);
  }
  const a0 = performance.now(), p = game.p;
  ip.x = p.px + (p.x - p.px) * alpha; ip.y = p.py + (p.y - p.py) * alpha; ip.z = p.pz + (p.z - p.pz) * alpha;
  if (Math.abs(p.x - p.px) > 3 || Math.abs(p.z - p.pz) > 3) { ip.x = p.x; ip.y = p.y; ip.z = p.z; }
  chase.update(ip, input.yaw, input.pitch, dtReal || 0.016);
  head.x = ip.x; head.y = ip.y + 1.5; head.z = ip.z;
  actors.update(game, alpha, camera.position, head);
  props.update(game);
  minimap.draw(game, input.yaw);
  showFlash(game);
  const a1 = performance.now();
  renderer.render(scene, camera);
  prof.view = a1 - a0; prof.render = performance.now() - a1;

  fpsFrames++; if (now - fpsT >= 500) {
    const fps = fpsFrames * 1000 / (now - fpsT); fpsFrames = 0; fpsT = now;
    if (showDebug) dbg.textContent = fps.toFixed(0) + ' fps  enemies ' + game.enemyCount() + '  sim ' + (stepMs / 30).toFixed(2) + ' ms  view ' + prof.view.toFixed(2) + ' ms';
    stepMs = 0;
  }
  if (perf.lastNow) { const f = now - perf.lastNow; perf.frames++; perf.worst = Math.max(perf.worst, f); }
  perf.lastNow = now;
}
requestAnimationFrame(frame);

// Test hooks: read and drive the run without touching its rules.
window.__ds = {
  game, input, chase, cfg: CFG, camera, scene, actors, assets, prof,
  mode: () => MODE,
  start: begin, results, setMode,
  pickDuelist, freeze: v => { frozen = !!v; },
  yaw: v => { input.yaw = v; },
  drive: (secs, cmd) => { const c = Object.assign({ f: 0, r: 0, yaw: input.yaw, jump: false, dash: false, slide: false, use: false }, cmd || {}); for (let t = 0; t < secs && !game.over && !game.offer; t += 1 / 60) game.step(1 / 60, c); drainEvents(); if (game.over && MODE === 'play') results(); drawHud(game, true); },
  fillSwarm: (n, kind) => { for (let i = 0; i < n; i++) spawnEnemy(game, kind); },
  perfReset: () => { perf.frames = 0; perf.worst = 0; perf.lastNow = 0; perf.t0 = performance.now(); },
  perfRead: () => ({ frames: perf.frames, ms: performance.now() - perf.t0, worstFrameMs: perf.worst })
};




