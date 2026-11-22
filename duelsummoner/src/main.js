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
import { quantise, emptyRecord } from './sim/input.js';
import { loadSave, recordRun, writeSave } from './core/save.js';
import { createBrowserHost } from './core/host.js';
import { simMeta, applyRun } from './core/meta.js';
import { showDeckBox, showLibrary } from './view/metaui.js';
import { QUESTS } from './data/meta.js';
import { Fx } from './view/fx.js';
import { KIND_LIST } from './data/enemies.js';

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
const assets = {
  wyvern: await loadModel('assets/models/ember-wyvern.ewv.b64'), hatchling: await loadModel('assets/models/cinder-hatchling.ewv.b64'),
  tyrant: await loadModel('assets/models/twinflare-tyrant.ewv.b64'), apprentice: await loadModel('assets/models/rune-apprentice.ewv.b64')
};
assets.puff = await loadPuffTexture('assets/models/puff.png.b64');                // falls back to a drawn puff if the file is missing

scene.add(buildMapMesh());
let duelist = 'kael';
const withProps = /[?&]props/.test(location.search);       // map objects are placed by the coming map generator; ?props shows the region-placed test set
const game = new Game(Date.now() & 0xffff, { duelist, world: withProps ? 'regions' : 'none' });
const host = createBrowserHost(canvas);
const save = loadSave(host);
const fx = new Fx(scene, save.settings);
const actors = new Actors(scene, assets, fx);
const props = new Props(scene);
const chase = new ChaseCamera(camera);
const input = host.input;
const minimap = new Minimap($('minimap'));

let MODE = 'start', last = 0, frozen = false, holdT = 0, lastFusions = 0;

// settings: reduce motion turns off shake, hit-stop, flashes, the boss zoom and the follow lag
function applySettings() {
  const s = save.settings; document.body.classList.toggle('rm', !!s.reduceMotion); chase.lag = !s.reduceMotion;
  for (const el of document.querySelectorAll('.setRM')) el.checked = !!s.reduceMotion;
  for (const el of document.querySelectorAll('.setShake')) { el.value = s.shake; el.disabled = !!s.reduceMotion; }
  for (const el of document.querySelectorAll('.setShakeV')) el.textContent = s.reduceMotion ? 'off' : s.shake;
}
for (const el of document.querySelectorAll('.setRM')) el.addEventListener('change', () => { save.settings.reduceMotion = el.checked; applySettings(); writeSave(host, save); });
for (const el of document.querySelectorAll('.setShake')) el.addEventListener('input', () => { save.settings.shake = +el.value; applySettings(); });
for (const el of document.querySelectorAll('.setShake')) el.addEventListener('change', () => writeSave(host, save));
applySettings();

function lock() { if (canvas.requestPointerLock) { try { canvas.requestPointerLock(); } catch (e) {} } }
function setMode(m) {
  MODE = m; input.enabled = m === 'play';
  for (const [id, mm] of [['startScreen', 'start'], ['pauseScreen', 'pause'], ['deadScreen', 'dead'], ['offerScreen', 'offer']]) $(id).classList.toggle('on', m === mm);
  if (m !== 'play' && document.pointerLockElement && document.exitPointerLock) document.exitPointerLock();
  $('hint').textContent = m === 'play' && !document.pointerLockElement ? 'Click the map to look around' : '';
  last = 0;
}
function begin() {
  ended = false; lastFusions = 0; holdT = 0; seenSp.clear(); fx.push = 0; game.opts.meta = simMeta(save.meta); game.reset(Date.now() & 0xffff, duelist); game.acc = 0; input.yaw = 0; input.pitch = 0; chase.reset(); input.keys = {};
  for (const m of actors.monsters.values()) scene.remove(m); actors.monsters.clear();
  for (const m of actors.specials.values()) scene.remove(m); actors.specials.clear();
  for (const m of actors.chests.values()) scene.remove(m); actors.chests.clear();
  drawHud(game, true); setMode('play'); lock();
}
function pickDuelist(id) { duelist = id; $('pickKael').classList.toggle('sel', id === 'kael'); $('pickMira').classList.toggle('sel', id === 'mira'); }
$('pickKael').addEventListener('click', () => pickDuelist('kael'));
$('pickMira').addEventListener('click', () => pickDuelist('mira'));
const showChips = () => { $('chipsLine').textContent = 'Star Chips ' + save.starChips; };
showChips();
$('deckBtn').addEventListener('click', () => showDeckBox(save, () => { writeSave(host, save); showChips(); }, showChips));
$('libBtn').addEventListener('click', () => showLibrary(save, showChips));
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
  if (MODE === 'offer' && !e.repeat) offerKey(game, e.code, menu);
});
window.addEventListener('blur', () => { if (MODE === 'play') setMode('pause'); });
document.addEventListener('visibilitychange', () => { if (document.hidden && MODE === 'play') setMode('pause'); });

// Menu choices enter the sim as input on a tick, like movement does.
const idleRec = emptyRecord(), liveRec = emptyRecord();
function menu(code) { idleRec.menu = code; game.tick(idleRec); idleRec.menu = 0; afterOfferChange(); }
function afterOfferChange() {
  if (game.fusions > lastFusions) { lastFusions = game.fusions; actors.fusionAt = actors.vt; holdT = 1.2; }            // Fusion set piece: the sim waits, as it does for an offer
  if (game.offer) showOffer(game, menu);                 // redraw / banish / shop buy: same screen, new cards
  else { setMode('play'); lock(); drawHud(game, true); }
}
let ended = false;
function results() {
  let info = { record: { bestTime: 0 }, newBest: false };
  let unlocked = [];
  if (!ended) {                                                          // saved once per run
    ended = true; info = recordRun(host, save, duelist, { time: game.t, kills: game.kills, level: game.level, bossKilled: game.bossKilled, chips: game.starChips() });
    const report = game.results({ runId: 'ds-' + game.seed + '-' + save.runs }); unlocked = applyRun(save.meta, report); writeSave(host, save); host.reportRun(report);
  }
  $('dQuests').textContent = unlocked.length ? 'Quest done: ' + unlocked.map(q => q.name + ' (unlocked ' + (q.unlock.card || q.unlock.item) + ')').join(', ') : '';
  $('resTitle').textContent = game.bossKilled ? 'VICTORY' : game.ended ? 'RUN ENDED' : 'DEFEATED';
  $('dTime').textContent = clock(game.t); countUp('dLevel', game.level); countUp('dKills', game.kills); countUp('dFusions', game.fusions);
  $('dOvertime').textContent = clock(game.overtimeSeconds()); countUp('dChips', game.starChips()); $('dBest').textContent = clock(save.records[duelist] ? save.records[duelist].bestTime : 0) + (info.newBest ? '  NEW BEST' : '');
  const why = game.bossKilled ? 'The Hollow Pharaoh fell. Overtime goes on until you fall.' : game.ended ? 'You ended the run.' : 'Downed by ' + (game.killedBy || 'the horde');
  $('dCause').textContent = why;
  const top = Object.entries(game.damageBy).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, v]) => k + ' ' + Math.round(v)).join('  /  ');
  $('dBreakdown').textContent = top ? 'Damage taken: ' + top : '';
  drawHud(game, true); setMode('dead');
}
// count-ups on the results screen (instant with reduce motion)
function countUp(id, to) {
  const el = $(id); if (save.settings.reduceMotion || to < 2) { el.textContent = to; return; }
  const t0 = performance.now(), dur = 700; el.textContent = 0;
  (function step(now) { const u = Math.min(1, (now - t0) / dur); el.textContent = Math.round(to * (1 - (1 - u) * (1 - u))); if (u < 1) requestAnimationFrame(step); })(t0);
}
const KCOL = KIND_LIST.map(k => k.color), PCOL = [0xb48cff, 0xf0c040, 0xff5a7a];
function onEvent(type, a, b, c, data) {
  if (type === 'banner') showBanner(data);
  else if (type === 'offer') { setMode('offer'); showOffer(game, menu); }
  else if (type === 'levelup') { showBanner('Level ' + a); fx.ring(ip.x, ip.y, ip.z, 3.2, 0xffd56a, 0.55); fx.burst(ip.x, ip.y + 1, ip.z, 22, 0xffe08a, 3, 6, 0.22, 0.8, 4); }
  else if (type === 'hit') fx.number(b, 1.7, c, a);
  else if (type === 'kill') fx.burst(b, 0.9, c, 6, KCOL[a] || 0xaaaaaa, 3.5, 4, 0.28, 0.55, 14);
  else if (type === 'pickup') fx.burst(ip.x, ip.y + 1.1, ip.z, 3, PCOL[a] || 0xffffff, 1.6, 2.5, 0.14, 0.35, 0);
  else if (type === 'hurt') fx.shake(b ? 0.55 : 0.28);
  else if (type === 'bossphase') { fx.hitstop(0.06); fx.shake(0.7); fx.flash(0.3); fx.ring(ip.x, ip.y, ip.z, 8, 0xe8b84a, 0.7); }
}
const seenSp = new Set(), PLATES = { warden: 'THE SEALED WARDEN', idol: 'TWIN JACKAL IDOLS', pharaoh: 'THE HOLLOW PHARAOH' };
let plateIdol = false, fovDirty = false;
function bossIntro() {                                              // name plate for elites and the boss, plus a 2 s zoom (skip with Enter or a click)
  for (const sp of game.sp) {
    if (!sp.alive || seenSp.has(sp)) continue; seenSp.add(sp);
    if (sp.kind === 'idol') { if (plateIdol) continue; plateIdol = true; }
    const pl = $('plate'); pl.innerHTML = PLATES[sp.kind] || ''; pl.classList.remove('on'); void pl.offsetWidth; pl.classList.add('on'); fx.push = fx.settings.reduceMotion ? 0 : 2;
  }
}
const skipIntro = () => { fx.push = 0; };
window.addEventListener('keydown', e => { if (e.code === 'Enter') skipIntro(); }); canvas.addEventListener('pointerdown', skipIntro);
function drainEvents() { game.drainEvents(onEvent); }

const dbg = $('debug'), showDebug = /[?&]debug/.test(location.search);
dbg.style.display = showDebug ? 'block' : 'none';
let lowShown = false, fpsFrames = 0, fpsT = 0, stepMs = 0;
const perf = { frames: 0, t0: 0, worst: 0, lastNow: 0 };
const head = { x: 0, y: 0, z: 0 }, ip = { x: 0, y: 0, z: 0 }, prof = { sim: 0, view: 0, render: 0 };

function frame(now) {
  requestAnimationFrame(frame);
  const dtReal = last ? Math.min(0.1, (now - last) / 1000) : 0;
  let alpha = game.alpha;
  if (MODE === 'play') {
    last = now;
    const s0 = performance.now();
    if (fx.stop > 0) fx.stop -= dtReal;                                   // hit-stop on boss phase breaks: the view waits, the sim keeps its tick count
    if (holdT > 0) holdT -= dtReal;
    if (dtReal > 0 && !frozen && fx.stop <= 0 && holdT <= 0) alpha = game.fixed(dtReal, quantise(input.command(), liveRec));
    bossIntro();
    prof.sim = performance.now() - s0; stepMs += prof.sim;
    drainEvents();
    if (game.over && MODE === 'play') results();
    if (MODE === 'play') drawHud(game, false);
  }
  const a0 = performance.now(), p = game.p;
  ip.x = p.px + (p.x - p.px) * alpha; ip.y = p.py + (p.y - p.py) * alpha; ip.z = p.pz + (p.z - p.pz) * alpha;
  if (Math.abs(p.x - p.px) > 3 || Math.abs(p.z - p.pz) > 3) { ip.x = p.x; ip.y = p.y; ip.z = p.z; }
  chase.update(ip, input.yaw, input.pitch, dtReal || 0.016);
  fx.applyShake(camera);
  if (fx.push > 0) { fx.push = Math.max(0, fx.push - dtReal); const u = 1 - fx.push / 2; camera.fov = 62 - 15 * Math.sin(Math.PI * Math.min(1, u)); camera.updateProjectionMatrix(); fovDirty = true; }
  else if (fovDirty) { camera.fov = 62; camera.updateProjectionMatrix(); fovDirty = false; }
  const low = MODE === 'play' && !game.over && game.p.hp / game.p.maxHp < 0.3; if (low !== lowShown) { lowShown = low; $('lowhp').classList.toggle('on', low); }
  if (window.__ds && window.__ds.camHold) { const h = window.__ds.camHold; camera.position.set(h.x, h.y, h.z); camera.lookAt(h.lx, h.ly, h.lz); }   // test hook: fixed camera for pictures
  head.x = ip.x; head.y = ip.y + 1.5; head.z = ip.z;
  actors.update(game, alpha, camera.position, head, dtReal);
  fx.update(dtReal, camera);
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
  start: begin, results, setMode, fx, onEvent, save,
  pickDuelist, freeze: v => { frozen = !!v; },
  yaw: v => { input.yaw = v; },
  drive: (secs, cmd) => { const c = Object.assign({ f: 0, r: 0, yaw: input.yaw, jump: false, dash: false, slide: false, use: false }, cmd || {}); for (let t = 0; t < secs && !game.over && !game.offer; t += 1 / 60) game.step(1 / 60, c); drainEvents(); if (game.over && MODE === 'play') results(); drawHud(game, true); },
  fillSwarm: (n, kind) => { for (let i = 0; i < n; i++) spawnEnemy(game, kind); },
  perfReset: () => { perf.frames = 0; perf.worst = 0; perf.lastNow = 0; perf.t0 = performance.now(); },
  perfRead: () => ({ frames: perf.frames, ms: performance.now() - perf.t0, worstFrameMs: perf.worst })
};




