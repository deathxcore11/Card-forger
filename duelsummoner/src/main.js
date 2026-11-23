// Duel Summoner, browser entry. Wires the simulation to the view and the UI modes: start, play, pause, offer, results.
import { CFG } from './data/config.js';
import { Game } from './sim/game.js';
import { Input } from './core/input.js';
import { clock } from './core/util.js';
import { buildMapMesh } from './view/mapMesh.js';
import { buildGateSeal } from './view/gateseal.js';
import { Bars } from './view/bars.js';
const bars = new Bars();
import { buildScenery } from './view/scenery.js';
import { LeyThreads } from './view/threads.js';
import { Actors } from './view/actors.js';
import { ChaseCamera } from './view/camera.js';
import { Minimap } from './view/minimap.js';
import { drawHud, showFlash, showBanner, drawStatPanel } from './view/hud.js';
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
import { initMenus } from './view/menus.js';
import { DIFF_CHIPS, DUELIST_INFO } from './data/progress.js';
import { packReplay, deflateInBrowser } from './core/replay.js';
import { boardUrl, sendAndFollow } from './core/board.js';
import { TouchControls } from './core/touch.js';
import { loadRig } from './view/rig.js';
import { BRACKET_NAMES } from './sim/ledger.js';
import { loadCreature } from './view/creature.js';
import { Ambient } from './view/ambient.js';
import { nearestProp } from './sim/world.js';
import { DIFFICULTY } from './data/stages.js';
import { KIND_LIST } from './data/enemies.js';

const T = window.THREE, $ = id => document.getElementById(id);
const canvas = $('view');
const renderer = new T.WebGLRenderer({ canvas, antialias: false });
const LOW = 2;                                   // render at half size for a chunky look
const scene = new T.Scene();
const HORIZON = 0xe8d6b0;                                    // the sky's horizon colour and the fog colour are one: far things fade into the haze, not into a flat beige sky
scene.background = new T.Color(HORIZON);
scene.fog = new T.Fog(HORIZON, 80, 300);
const sky = new T.Mesh(new T.SphereGeometry(500, 16, 8), new T.ShaderMaterial({ side: T.BackSide, depthWrite: false, depthTest: false, fog: false,
  uniforms: { top: { value: new T.Color(0x8fb2cc) }, hor: { value: new T.Color(HORIZON) }, low: { value: new T.Color(0xd9c29a) } },
  vertexShader: 'varying float vy; void main() { vy = normalize(position).y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position.z = gl_Position.w; }',
  fragmentShader: 'uniform vec3 top; uniform vec3 hor; uniform vec3 low; varying float vy; void main() { vec3 c = vy >= 0.0 ? mix(hor, top, smoothstep(0.0, 0.6, vy)) : mix(hor, low, smoothstep(0.0, -0.3, vy)); gl_FragColor = vec4(c, 1.0); }' }));
sky.frustumCulled = false; sky.renderOrder = -10; scene.add(sky);       // a sky dome: cooler and darker overhead than at the horizon (one draw, about 250 triangles)
const camera = new T.PerspectiveCamera(62, 1, 0.5, 600);
let fpsCap = 60, lastRender = 0;                     // a setting (30, 60, 90 or 120); a frame that comes sooner than the cap allows is skipped
let fovSetting = 100, baseV = 62;                    // the setting is HORIZONTAL degrees, so it means the same on every screen shape; the vertical angle follows from the aspect and never goes past 88
let fovK = 1;
function fitFov() { const a = Math.max(0.3, camera.aspect || 1.78); baseV = Math.max(64, Math.min(88, 2 * Math.atan(Math.tan(fovSetting * Math.PI / 360) / a) * 180 / Math.PI)); fovK = Math.tan(67.7 * Math.PI / 360) / Math.tan(baseV * Math.PI / 360);       // vertical angle held to 64-88; the camera arm scales with it so the duelist keeps the same share of the screen on every screen shape
  camera.fov = baseV; camera.updateProjectionMatrix(); }
// the look: only the sun is warm; the sky light is cool and its bounce from the ground is warm and dark, so up-faces land near x1.0 R, x0.97 G, x0.90 B
scene.add(new T.HemisphereLight(0xdfe6f0, 0x6a5038, 0.74));
const sun = new T.DirectionalLight(0xffe2b0, 0.66); sun.position.set(60, 90, 30); scene.add(sun);

function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setPixelRatio(1); renderer.setSize(Math.ceil(w / LOW), Math.ceil(h / LOW), false);
  camera.aspect = w / h; fitFov();
}
window.addEventListener('resize', resize); resize();

// the owner's models are optional local assets; the placeholders stay if they are missing
const assets = {
  wyvern: await loadModel('assets/models/ember-wyvern.ewv.b64'), hatchling: await loadModel('assets/models/cinder-hatchling.ewv.b64'),
  tyrant: await loadModel('assets/models/twinflare-tyrant.ewv.b64'), apprentice: await loadModel('assets/models/rune-apprentice.ewv.b64')
};
assets.kael = await loadRig('assets/models/duelist-kael-anim.glb', undefined, [{ url: 'assets/models/duelist-kael-anim-2.glb', seconds: { land_heavy: 0.9 } }]);         // the skinned, animated duelist; the robe stand-in is used when it is missing
assets.wyvernPrep = await loadCreature('assets/models/mon-ember-wyvern-f1-rig.glb');       // the rigged Ember Wyvern, form 1
assets.butterflyPrep = await loadCreature('assets/models/life-butterfly-rig.glb');         // ambient life: the rigged butterfly
assets.mira = await loadRig('assets/models/duelist-mira-anim.glb', { retime: { land_light: 0.5, land_heavy: 0.9 } });
assets.puff = await loadPuffTexture('assets/models/puff.png.b64');                // falls back to a drawn puff if the file is missing

document.addEventListener('contextmenu', e => { if (!/^(INPUT|TEXTAREA)$/.test((e.target || {}).tagName)) e.preventDefault(); });       // no browser menu over the game or its overlays
let sceneryGroup = null, mapMesh = null, gateSeal = null, viewMapKey = '';
function syncMap() {                                                       // the stage's map was generated by the sim; build its mesh and minimap once
  if (game.map.key === viewMapKey) return; viewMapKey = game.map.key;
  if (mapMesh) { scene.remove(mapMesh); mapMesh.traverse(o => { if (o.geometry) o.geometry.dispose(); }); }
  mapMesh = buildMapMesh(game.map); scene.add(mapMesh);
    if (gateSeal) scene.remove(gateSeal); gateSeal = buildGateSeal(game.map); scene.add(gateSeal);
    if (sceneryGroup) { scene.remove(sceneryGroup); sceneryGroup.traverse(o => { if (o.geometry) o.geometry.dispose(); }); sceneryGroup = null; }
    if (!/[?&]scenery=0/.test(location.search)) { sceneryGroup = buildScenery(game.map, game.stage || 0, assets); scene.add(sceneryGroup); ambient.setSpots(sceneryGroup.userData.flowerSpots, game.stage || 0, game.map.hash); } else ambient.clear(); minimap.setMap(game.map);
    try { renderer.compile(scene, camera); } catch (e) { /* warm-up is best effort */ }       // shaders are built behind the stage card, so the first frames do not hitch
}
let duelist = 'kael';
const withProps = /[?&]props/.test(location.search);       // map objects are placed by the coming map generator; ?props shows the region-placed test set
const game = new Game(Date.now() & 0xffff, { duelist, world: withProps ? 'regions' : 'none' });
const host = createBrowserHost(canvas);
const save = loadSave(host);
const fx = new Fx(scene, save.settings);
const actors = new Actors(scene, assets, fx);
const ambient = new Ambient(scene, assets.butterflyPrep);
const threads = new LeyThreads(scene, 6);                               // crimson ribbons toward the Gate
const props = new Props(scene);
const chase = new ChaseCamera(camera);
const input = host.input;
const minimap = new Minimap($('minimap'));
syncMap();

let touch = null, autoWalk = null, mapOpen = false;                                        // tap-to-use: walk to a far chest, then open it
let pendingUse = false, MODE = 'start', last = 0, frozen = false, holdT = 0, lastFusions = 0;

// settings: reduce motion turns off shake, hit-stop, flashes, the boss zoom and the follow lag
function applySettings() {
  const s = save.settings; document.body.classList.toggle('rm', !!s.reduceMotion); chase.lag = !s.reduceMotion;
  fpsCap = [30, 60, 90, 120].includes(+s.fpsCap) ? +s.fpsCap : 60; for (const el of document.querySelectorAll('.setFps')) el.value = fpsCap;
  fovSetting = Math.max(80, Math.min(115, +s.fov || 100)); fitFov(); for (const el of document.querySelectorAll('.setFov')) el.value = fovSetting; for (const el of document.querySelectorAll('.setFovV')) el.textContent = fovSetting;
  for (const el of document.querySelectorAll('.setRM')) el.checked = !!s.reduceMotion;
  for (const el of document.querySelectorAll('.setShake')) { el.value = s.shake; el.disabled = !!s.reduceMotion; }
  for (const el of document.querySelectorAll('.setShakeV')) el.textContent = s.reduceMotion ? 'off' : s.shake;
}
function bindSettings() {
  for (const el of document.querySelectorAll('.setRM')) el.onchange = () => { save.settings.reduceMotion = el.checked; applySettings(); writeSave(host, save); };
  for (const el of document.querySelectorAll('.setShake')) { el.oninput = () => { save.settings.shake = +el.value; applySettings(); }; el.onchange = () => writeSave(host, save); }
  for (const el of document.querySelectorAll('.setFps')) el.onchange = () => { save.settings.fpsCap = +el.value; applySettings(); writeSave(host, save); };
  for (const el of document.querySelectorAll('.setFov')) { el.oninput = () => { save.settings.fov = +el.value; applySettings(); }; el.onchange = () => writeSave(host, save); }
  applySettings();
}
bindSettings();

function lock() { if (canvas.requestPointerLock) { try { canvas.requestPointerLock(); } catch (e) {} } }
function setMode(m) {
  MODE = m; input.enabled = m === 'play';
  for (const [id, mm] of [['startScreen', 'start'], ['pauseScreen', 'pause'], ['deadScreen', 'dead'], ['offerScreen', 'offer']]) $(id).classList.toggle('on', m === mm);
  if (m !== 'play' && document.pointerLockElement && document.exitPointerLock) document.exitPointerLock();
  $('hint').textContent = m === 'play' && !document.pointerLockElement && !(touch && touch.isTouch) ? 'Click the map to look around' : ''; if (touch) touch.setEnabled(m === 'play');
  last = 0;
}
function begin(mode, sel) {
  sel = sel || {}; if (sel.duelist) pickDuelist(sel.duelist);
  game.opts.mode = typeof mode === 'string' ? mode : 'run'; game.opts.world = 'regions'; game.opts.difficulty = sel.difficulty || save.settings.difficulty; game.opts.oaths = sel.oaths || []; game.opts.map = sel.map || 'ruins';
  ended = false; plateIdol = false; sigils.length = 0; lastFusions = 0; holdT = 0; seenSp.clear(); fx.push = 0; game.opts.meta = simMeta(save.meta); bars.reset(); game.reset(/[?&]seed=(\d+)/.test(location.search) ? +/[?&]seed=(\d+)/.exec(location.search)[1] : Date.now() & 0xffff, duelist); game.acc = 0; input.yaw = 0; input.pitch = 0; chase.reset(); input.keys = {};
  for (const m of actors.monsters.values()) scene.remove(m); actors.monsters.clear();
  for (const m of actors.specials.values()) scene.remove(m); actors.specials.clear();
  for (const m of actors.chests.values()) scene.remove(m); actors.chests.clear();
  drawHud(game, true); setMode('play'); lock();
  const blind = !!game.oaths.blind; for (const id of ['minimap', 'boss', 'plate']) $(id).style.visibility = blind ? 'hidden' : '';      // Blind Oath
}
function pickDuelist(id) { duelist = id; }
const menus = initMenus({ save, persist: () => writeSave(host, save), begin, bindSettings: () => { bindSettings(); },
  showDeckBox: () => showDeckBox(save, () => writeSave(host, save), () => menus.showMain()) });
$('restartBtn').addEventListener('click', () => begin(game.opts.mode, { duelist, difficulty: game.opts.difficulty, oaths: game.opts.oaths, map: game.opts.map }));
$('menuBtn').addEventListener('click', () => { setMode('start'); menus.showMain(); });
menus.showMain();
$('endBtn').addEventListener('click', () => { game.endRun(); results(); });
$('resumeBtn').addEventListener('click', () => { setMode('play'); lock(); });
canvas.addEventListener('mousedown', () => { if (MODE === 'play') lock(); });
document.addEventListener('pointerlockchange', () => {
  if (!document.pointerLockElement && MODE === 'play') setMode('pause');
  else if (MODE === 'play') $('hint').textContent = '';
});
function toggleMap(force) { const want = force === undefined ? !mapOpen : force; if (want && MODE !== 'play') return; mapOpen = want; $('mapOverlay').style.display = want ? 'flex' : 'none'; if (want) { if (document.pointerLockElement && document.exitPointerLock) { /* keep play mode: the overlay pauses the sim */ } } }
window.addEventListener('keydown', e => { if (e.code === 'KeyM' && !e.repeat && (MODE === 'play' || mapOpen)) { e.preventDefault(); toggleMap(); } else if (e.code === 'Escape' && mapOpen) { e.preventDefault(); toggleMap(false); } });
$('minimap').addEventListener('click', () => { if (MODE === 'play') toggleMap(true); }); $('mapOverlay').addEventListener('click', () => toggleMap(false));
let statsOpen = false;
window.addEventListener('keydown', e => { if (e.code === 'Tab' && (MODE === 'play' || MODE === 'pause')) { e.preventDefault(); statsOpen = !statsOpen; drawStatPanel(game, statsOpen); } });
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
    ended = true; const chips = Math.floor(game.starChips() * (DIFF_CHIPS[game.difficulty] || 1));         // Star Chips scale with difficulty (separate from the score multiplier)
    info = recordRun(host, save, duelist, { time: game.t, kills: game.kills, level: game.level, bossKilled: game.bossKilled, chips });
    const report = game.results({ runId: 'ds-' + game.seed + '-' + save.runs }); unlocked = applyRun(save.meta, report); for (const q of unlocked) if (q.reward && q.reward.chips) save.starChips += q.reward.chips; writeSave(host, save);
    // the verifiable replay (seed, difficulty, mode, build, the run-length input tape and the final state hash) rides along with the report
    packReplay(game.replayRaw(), typeof CompressionStream !== 'undefined' ? deflateInBrowser : null).then(r => { report.replay = r; host.reportRun(report); const base = boardUrl(save.settings); if (base) sendAndFollow(base, r, t => { $('dBoard').textContent = t; }); }).catch(() => host.reportRun(report));
  }
  $('dQuests').textContent = unlocked.length ? 'Quest done: ' + unlocked.map(q => q.name + ' (' + (q.reward.chips ? '+' + q.reward.chips + ' Star Chips' : 'unlocked ' + (q.reward.card || q.reward.item || q.reward.duelist || q.reward.outfit || q.reward.regalia)) + ')').join(', ') : '';
  $('resTitle').textContent = game.bossKilled ? 'VICTORY' : game.ended ? 'RUN ENDED' : 'DEFEATED';
  $('dTime').textContent = clock(game.t); countUp('dLevel', game.level); countUp('dKills', game.kills); countUp('dFusions', game.fusions);
  $('dOvertime').textContent = clock(game.overtimeSeconds()); countUp('dChips', Math.floor(game.starChips() * (DIFF_CHIPS[game.difficulty] || 1))); countUp('dScore', game.score()); $('dDiff').textContent = DIFFICULTY[game.difficulty].name + (game.mode === 'quick' ? ' (Quick Duel)' : ''); $('dBest').textContent = clock(save.records[duelist] ? save.records[duelist].bestTime : 0) + (info.newBest ? '  NEW BEST' : '');
  const stg = game.mode !== 'classic' && game.stages.length > 1 ? ' in Stage ' + (game.stage + 1) : '';
  const why = game.bossKilled ? (game.mode !== 'classic' ? 'The Hollow King fell. ' + (game.duelOn ? 'You Dueled On into Overtime.' : 'The Vault is closed.') : 'The Hollow Pharaoh fell. Overtime goes on until you fall.') : game.ended ? 'You ended the run' + stg + '.' : 'Downed by ' + (game.killedBy || 'the horde') + stg;
  $('dCause').textContent = why; $('dBoard').textContent = '';
  const top = Object.entries(game.damageBy).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, v]) => k + ' ' + Math.round(v)).join('  /  ');
  $('dBreakdown').textContent = top ? 'Damage taken: ' + top : '';
  { const BD = game.bracketDmg; let tot = 0, best = 0; for (let i = 1; i < 10; i++) { tot += BD[i]; if (BD[i] > BD[best]) best = i; }          // which bracket the extra damage came from
    $('dBracket').textContent = tot > 0 && best ? 'What broke the game: ' + BRACKET_NAMES[best] + ' (' + Math.round(BD[best] / tot * 100) + '% of your extra damage)' : ''; }
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
  if (actors.rig) { if (type === 'hurt') actors.rig.overlay('hurt'); else if (type === 'levelup') actors.rig.once('level_up'); else if (type === 'fusionchest') actors.rig.once('fusion'); }      // one-shot poses, played only if the clip exists
  if (type === 'banner') showBanner(data);
  else if (type === 'offer') { setMode('offer'); showOffer(game, menu); }
  else if (type === 'levelup') { showBanner('Level ' + a); fx.ring(ip.x, ip.y, ip.z, 3.2, 0xffd56a, 0.55); fx.burst(ip.x, ip.y + 1, ip.z, 22, 0xffe08a, 3, 6, 0.22, 0.8, 4); }
  else if (type === 'hit') fx.number(b, 1.7, c, a, data);
  else if (type === 'ace') { fx.ring(a, b, c, 4, 0xffd23f, 0.5); fx.shake(0.1); showBanner('An Ace approaches'); }
  else if (type === 'trophy') { fx.ring(a, b, c, 4.5, 0xffe9a0, 0.6); fx.burst(a, b + 1, c, 24, 0xffe9a0, 3, 6, 0.25, 0.9, 6); fx.shake(0.12); }
  else if (type === 'kill') fx.burst(b, 0.9, c, 6, KCOL[a] || 0xaaaaaa, 3.5, 4, 0.28, 0.55, 14);
  else if (type === 'pickup') fx.burst(ip.x, ip.y + 1.1, ip.z, 3, PCOL[a] || 0xffffff, 1.6, 2.5, 0.14, 0.35, 0);
  else if (type === 'hurt') fx.shake(b ? 0.55 : 0.28);
  else if (type === 'announce') sigils.push({ x: b, z: c, until: actors.vt + 6.5, next: 0 });
  else if (type === 'gatewake') { fx.shake(0.5); fx.beam(game.map.gate.x, 4, game.map.gate.z, 0xffe9a0, 6); fx.ring(game.map.gate.x, 4, game.map.gate.z, 8, 0xffe9a0, 1); }
  else if (type === 'descent') { fx.flash(1); fx.shake(0.4); }
  else if (type === 'stage') { fx.flash(0.8); }
  else if (type === 'gatedown') { fx.flash(0.6); fx.shake(0.6); }
  else if (type === 'bossphase') { fx.hitstop(0.06); fx.shake(0.7); fx.flash(0.3); fx.ring(ip.x, ip.y, ip.z, 8, 0xe8b84a, 0.7); }
}
const sigils = [];                                                      // boss rings announced 5 s ahead: a sigil scorches the ground
const av = { x: 0, y: 0, z: 0 };
function fusionMarker() {                                               // light beam and an edge-of-screen arrow toward the nearest guaranteed Fusion chest
  const arrow = $('arrow'); let best = null, bd = 1e9;
  for (const c of game.chests) if (c.guaranteed && !c.open) { const d = (c.x - game.p.x) ** 2 + (c.z - game.p.z) ** 2; if (d < bd) { bd = d; best = c; } }
  if (!best) { if (arrow.style.display !== 'none') arrow.style.display = 'none'; return; }
  if (actors.vt >= (fusionMarker.next || 0)) { fusionMarker.next = actors.vt + 2.5; fx.beam(best.x, best.y, best.z, 0xffe9a0, 3); }
  av.x = best.x; av.y = best.y + 1; av.z = best.z; const v = camera.position.clone ? null : null;
  const P = fusionMarker.v || (fusionMarker.v = new T.Vector3()); P.set(av.x, av.y, av.z).project(camera);
  let sx = P.x, sy = P.y; const behind = P.z > 1; if (behind) { sx = -sx; sy = -sy; }
  const off = behind || Math.abs(sx) > 0.92 || Math.abs(sy) > 0.88;
  if (!off) { if (arrow.style.display !== 'none') arrow.style.display = 'none'; return; }
  const k = Math.max(Math.abs(sx) / 0.92, Math.abs(sy) / 0.88, 1e-3); sx /= k; sy /= k;
  arrow.style.display = 'block'; arrow.style.left = ((sx * 0.5 + 0.5) * innerWidth) + 'px'; arrow.style.top = ((-sy * 0.5 + 0.5) * innerHeight) + 'px';
  arrow.style.transform = 'translate(-50%,-50%) rotate(' + Math.atan2(sx, sy) + 'rad)';
}
function ringMarks() {
  const now = actors.vt;
  fusionMarker();
  for (let i = sigils.length - 1; i >= 0; i--) { const s = sigils[i]; if (now > s.until) { sigils.splice(i, 1); continue; } if (now >= s.next) { s.next = now + 0.5; fx.ring(s.x, 0.1, s.z, 4, 0xe8b84a, 0.7); } }
  if (game.mode !== 'classic') {
    if (game.circle && now >= (ringMarks.c || 0)) { ringMarks.c = now + 0.5; fx.ring(game.circle.x, 0.1, game.circle.z, 3.5, 0xc9a3ff, 0.7); }
    if (game.altar && !game.altar.used && now >= (ringMarks.a || 0)) { ringMarks.a = now + 0.5; fx.ring(game.altar.x, 0.1, game.altar.z, 3.5, 0xffd56a, 0.7); }
  }
}
const seenSp = new Set(), PLATES = { warden: 'THE SEALED WARDEN', idol: 'TWIN JACKAL IDOLS', pharaoh: 'THE HOLLOW PHARAOH' };
let plateIdol = false, fovDirty = false;
function bossIntro() {                                              // name plate for elites and the boss, plus a 2 s zoom (skip with Enter or a click)
  for (const sp of game.sp) {
    if (!sp.alive || seenSp.has(sp)) continue; seenSp.add(sp);
    if (sp.kind === 'idol') { if (plateIdol) continue; plateIdol = true; }
    const pl = $('plate'); pl.innerHTML = sp.role ? sp.name.toUpperCase() : (PLATES[sp.kind] || ''); pl.classList.remove('on'); void pl.offsetWidth; pl.classList.add('on'); fx.push = fx.settings.reduceMotion ? 0 : 2;
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

// Touch: stick, look, buttons, pause, and tap-to-use. A tap picks the nearest usable thing within a thumb's width of the finger.
touch = new TouchControls(input.raw || input, {
  look: (dx, dy) => input.look(dx, dy), onManualMove: () => { autoWalk = null; },
  onPause: () => { if (MODE === 'play') setMode('pause'); },
  onTap: (x, y) => { if (MODE !== 'play' || game.offer) return; pickAndUse(x, y); }
});
const _v = new T.Vector3();
function usables() {                                              // every world thing a duelist can press E on, as { x, y, z, near }
  const out = [], p = game.p, R = 3.2, add = (o, y) => out.push({ x: o.x, y: (o.y || 0) + (y || 1), z: o.z, near: (o.x - p.x) ** 2 + (o.z - p.z) ** 2 < R * R });
  for (const c of game.chests) if (!c.open) add(c, 1);
  const W = game.world; if (W) { for (const c of W.cchests || []) if (!c.open) add(c, 1); for (const s of W.stones || []) if (!s.used) add(s, 1.2); if (W.broker) add(W.broker, 1.5); if (W.altar && !W.altar.used) add(W.altar, 1.2); }
  return out;
}
export function pickAndUse(cx, cy) {
  const w = innerWidth, h = innerHeight; let best = null, bd = 80 * 80;                                     // 80 px: about a fingertip and a half
  for (const u of usables()) { _v.set(u.x, u.y, u.z).project(camera); if (_v.z > 1) continue; const sx = (_v.x * 0.5 + 0.5) * w, sy = (-_v.y * 0.5 + 0.5) * h, d = (sx - cx) ** 2 + (sy - cy) ** 2; if (d < bd) { bd = d; best = u; } }
  if (!best) return false;
  if (best.near) { pendingUse = true; autoWalk = null; } else autoWalk = { x: best.x, z: best.z, stop: 2.4, t0: performance.now() };
  return true;
}
// Landmark tags: a short label over every landmark you are close to, saying what it is and what it gives, so nothing has to be guessed. Spent ones turn grey and stay.
const tagEls = [], tagV = new T.Vector3();
function landmarkTags() {
  const W = game.world, p = game.p, out = [];
  const add = (o, text, cls, y) => { const dx = o.x - p.x, dz = o.z - p.z, d2 = dx * dx + dz * dz; if (d2 < 30 * 30) out.push({ x: o.x, y: (o.y || 0) + y, z: o.z, text, cls, d2 }); };
  if (W) {
    for (const s of W.stones || []) add(s, s.used ? 'Witness Stone: used' : 'Witness Stone: 1 free item of 3', s.used ? 'spent' : 'free', 2.1);
    for (const s of W.shrines || []) add(s, s.done ? 'Shrine of Tribute: done' : 'Shrine of Tribute: hold the ring, pick a boon', s.done ? 'spent' : 'free', 2.4);
    if (W.broker) add(W.broker, 'Relic Broker: shop', 'shop', 2.6);
    if (W.altar) add(W.altar, W.altar.used ? 'Altar: used' : 'Altar of Tribute: banish or tribute', W.altar.used ? 'spent' : 'seal', 2.4);
    for (const c of W.cchests || []) if (!c.open) add(c, c.trophy ? 'Trophy Chest: free, open it' : 'Card Chest: ' + (c.free ? 'free' : 'coins'), c.free || c.trophy ? 'free' : 'shop', 1.9);
  }
  for (const c of game.chests) if (!c.open) add(c, 'Sealed Chest: free item', 'free', 1.9);
  return out;
}
function drawTags() {
  const list = MODE === 'play' && !mapOpen ? landmarkTags() : []; list.sort((a, b) => a.d2 - b.d2); const n = Math.min(6, list.length), host = $('tags'), w = innerWidth, h = innerHeight;
  for (let i = 0; i < Math.max(n, tagEls.length); i++) {
    if (i >= tagEls.length) { const el = document.createElement('div'); el.className = 'wtag'; host.appendChild(el); tagEls.push(el); }
    const el = tagEls[i]; if (i >= n) { el.style.display = 'none'; continue; }
    const t = list[i]; tagV.set(t.x, t.y, t.z).project(camera); if (tagV.z > 1) { el.style.display = 'none'; continue; }
    el.style.display = 'block'; el.className = 'wtag ' + t.cls; if (el.textContent !== t.text) el.textContent = t.text; el.style.left = ((tagV.x * 0.5 + 0.5) * w) + 'px'; el.style.top = ((-tagV.y * 0.5 + 0.5) * h) + 'px';
  }
}
function frame(now) {
  requestAnimationFrame(frame);
  if (fpsCap && now - lastRender < 1000 / fpsCap - 2) return; lastRender = now;
  syncMap();
  const dtReal = last ? Math.min(0.1, (now - last) / 1000) : 0;
  let alpha = game.alpha;
  if (MODE === 'play') {
    last = now;
    const s0 = performance.now();
    if (fx.stop > 0) fx.stop -= dtReal;                                   // hit-stop on boss phase breaks: the view waits, the sim keeps its tick count
    if (holdT > 0) holdT -= dtReal;
    if (dtReal > 0 && !frozen && !mapOpen && fx.stop <= 0 && holdT <= 0) {
      // a one-tick press (E) must survive frames that run no sim tick (above 60 fps most frames run none): latch it until a tick has consumed it
      const cmd = input.command();
      if (autoWalk) {                                                        // smart tap: steer to the thing you tapped, open it on arrival; any stick or key input cancels
        const p = game.p, dx = autoWalk.x - p.x, dz = autoWalk.z - p.z, d = Math.hypot(dx, dz), sy = Math.sin(input.yaw), cy = Math.cos(input.yaw);
        if (cmd.f || cmd.r || (performance.now() - autoWalk.t0) > 6000) autoWalk = null;
        else if (d < autoWalk.stop) { cmd.use = true; autoWalk = null; }
        else { const fx = -sy, fz = -cy, rx = -fz, rz = fx; cmd.f = (dx * fx + dz * fz) / d; cmd.r = (dx * rx + dz * rz) / d; }
      }
      if (cmd.use) pendingUse = true; cmd.use = pendingUse; const t0 = game.tickN;
      alpha = game.fixed(dtReal, quantise(cmd, liveRec)); if (game.tickN !== t0) pendingUse = false;
    }
    bossIntro(); touch.setUseVisible(!!game.prompt && !game.offer);
    prof.sim = performance.now() - s0; stepMs += prof.sim;
    drainEvents();
    if (game.over && MODE === 'play') results();
    if (MODE === 'play') { drawHud(game, false); if (statsOpen) drawStatPanel(game, true); }
  }
  const a0 = performance.now(), p = game.p;
  ip.x = p.px + (p.x - p.px) * alpha; ip.y = p.py + (p.y - p.py) * alpha; ip.z = p.pz + (p.z - p.pz) * alpha;
  if (Math.abs(p.x - p.px) > 3 || Math.abs(p.z - p.pz) > 3) { ip.x = p.x; ip.y = p.y; ip.z = p.z; }
  {   // camera: the bigger the nearest big boss, the further back and higher it sits (gate bosses 6x to 10x get the most)
    let big = 0; for (const sp of game.sp) if (sp.alive && !sp.dead && sp.size > big && (sp.x - ip.x) ** 2 + (sp.z - ip.z) ** 2 < 2500) big = sp.size;
    chase.zoomTo = fx.rm_ ? 1 : 1 + Math.min(0.95, Math.max(0, (big - 4) / 11));
  }
  bars.tick(dtReal || 0.016, game, document.body.classList.contains('rm'), performance.now());
  chase.cols = game.colliders; chase.fovK = fovK; sky.position.copy(camera.position); if (gateSeal) gateSeal.userData.update(camera.position, performance.now() / 1000); chase.update(ip, input.yaw, input.pitch, dtReal || 0.016);
  if (sceneryGroup && sceneryGroup.userData.fade) sceneryGroup.userData.fade(chase.pos, ip, dtReal || 0.016);
  if (MODE === 'play') ambient.update(dtReal, camera, game.en);
  threads.update(game.mode !== 'classic' && game.map ? game.map.gate : null, ip, MODE === 'play' ? dtReal : 0, camera, MODE === 'play' && game.boss.state === 'idle' && !game.offer);
  fx.applyShake(camera);
  if (fx.push > 0) { fx.push = Math.max(0, fx.push - dtReal); const u = 1 - fx.push / 2; camera.fov = baseV * (1 - 0.24 * Math.sin(Math.PI * Math.min(1, u))); camera.updateProjectionMatrix(); fovDirty = true; }
  else if (fovDirty) { camera.fov = baseV; camera.updateProjectionMatrix(); fovDirty = false; }
  const low = MODE === 'play' && !game.over && game.p.hp / game.p.maxHp < 0.3; if (low !== lowShown) { lowShown = low; $('lowhp').classList.toggle('on', low); }
  if (window.__ds && window.__ds.camHold) { const h = window.__ds.camHold; camera.position.set(h.x, h.y, h.z); camera.lookAt(h.lx, h.ly, h.lz); }   // test hook: fixed camera for pictures
  head.x = ip.x; head.y = ip.y + 1.5; head.z = ip.z;
  actors.update(game, alpha, camera.position, head, dtReal);
  ringMarks();
  fx.update(dtReal, camera);
  props.update(game);
  drawTags(); minimap.draw(game, input.yaw); if (mapOpen) minimap.drawFull($('fullmap'), game, input.yaw);
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
  bars,
  renderer,
  game, input, chase, touch, pickAndUse, threads, ambient, toggleMap, mapIsOpen: () => mapOpen, cfg: CFG, camera, scene, actors, assets, prof,
  mode: () => MODE,
  start: begin, begin, results, setMode, menus, fx, onEvent, save,
  pickDuelist, freeze: v => { frozen = !!v; },
  yaw: v => { input.yaw = v; },
  drive: (secs, cmd) => { const c = Object.assign({ f: 0, r: 0, yaw: input.yaw, jump: false, dash: false, slide: false, use: false }, cmd || {}); for (let t = 0; t < secs && !game.over && !game.offer; t += 1 / 60) game.step(1 / 60, c); drainEvents(); if (game.over && MODE === 'play') results(); drawHud(game, true); },
  fillSwarm: (n, kind) => { for (let i = 0; i < n; i++) spawnEnemy(game, kind); },
  perfReset: () => { perf.frames = 0; perf.worst = 0; perf.lastNow = 0; perf.t0 = performance.now(); },
  perfRead: () => ({ frames: perf.frames, ms: performance.now() - perf.t0, worstFrameMs: perf.worst })
};










