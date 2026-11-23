// Duel Summoner, browser entry. Wires the simulation to the view and the UI modes: start, play, pause, offer, results.
import { CFG } from './data/config.js';
import { K } from './data/tuning.js';
import { Game } from './sim/game.js';
import { Input } from './core/input.js';
import { clock } from './core/util.js';
import { buildMapMesh } from './view/mapMesh.js';
import { chooseStartYaw } from './view/startview.js';
import { prewarmStage } from './gen/v2/stagemap.js';
import { buildGateSeal } from './view/gateseal.js';
import { buildWater, ripple, ageRipples } from './view/water.js';
import { updateEngine, setActorLight, makeSky, setShadeMask, E } from './view/engine.js';
import { poolSpots } from './gen/road.js';
import { lookFor, buildPaletteLUT, STAGE_LOOK as STAGE_LOOK_LIST } from './data/look.js';
import { Bars } from './view/bars.js';
import { chestPrice } from './sim/world.js';
import { heightAt } from './sim/terrain.js';
const bars = new Bars();
import { buildScenery } from './view/scenery.js';
import { buildGrass, detailLevel } from './view/grass.js';
import { Composite } from './view/composite.js';
import { OWN as OWN_NS } from './view/ownfx.js';
const OWN_UNI = OWN_NS.uni;
import { MONSTERS, FUSIONS } from './data/cards.js';
import { RAMP } from './data/fxramp.js';
import { ownColour } from './view/fxcolour.js';
import { LeyThreads } from './view/threads.js';
import { Actors } from './view/actors.js';
import { ChaseCamera } from './view/camera.js';
import { Minimap } from './view/minimap.js';
import { drawHud, showFlash, showBanner, clearBanners, drawStatPanel, inputMode } from './view/hud.js';
import { keyWords } from './ui/prompts.js';
import { renderPause, setTab as pauseTab, bindHolds, matHtml, statRows } from './view/pause.js';
import { deviceClass } from './ui/device.js';
import { defaultFor } from './ui/settings-schema.js';
import { showOffer, offerKey, offerGuard } from './view/offer.js';
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
import { updateSee, SEE } from './view/seethrough.js';
import { tone } from './view/reveal.js';
import { PadEdges, firstPad, move as padMove, press as padPressEl, adjust as padAdjust, back as padBack, clearRing, ringEl } from './core/padnav.js';
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
const scene = new T.Scene();
const HORIZON = 0xe8d6b0;                                    // the sky's horizon colour and the fog colour are one: far things fade into the haze, not into a flat beige sky
scene.background = new T.Color(HORIZON);
scene.fog = new T.Fog(HORIZON, 80, 300);
const sky = makeSky(); scene.add(sky);       // the engine sky dome: banded gradient, sun, clouds (view/engine.js)
const camera = new T.PerspectiveCamera(62, 1, 0.15, 600);
let fpsCap = 60, lastRender = 0;                     // a setting (30, 60, 90 or 120); a frame that comes sooner than the cap allows is skipped
let fovSetting = 100, baseV = 62;                    // the setting is HORIZONTAL degrees, so it means the same on every screen shape; the vertical angle follows from the aspect and never goes past 88
let fovK = 1;
function fitFov() { const a = Math.max(0.3, camera.aspect || 1.78); baseV = Math.max(64, Math.min(88, 2 * Math.atan(Math.tan(fovSetting * Math.PI / 360) / a) * 180 / Math.PI)); fovK = Math.tan(67.7 * Math.PI / 360) / Math.tan(baseV * Math.PI / 360);       // vertical angle held to 64-88; the camera arm scales with it so the duelist keeps the same share of the screen on every screen shape
  camera.fov = baseV; camera.updateProjectionMatrix(); }
// the look: only the sun is warm; the sky light is cool and its bounce from the ground is warm and dark, so up-faces land near x1.0 R, x0.97 G, x0.90 B
scene.add(new T.HemisphereLight(0xdfe6f0, 0x6a5038, 0.74));
const sun = new T.DirectionalLight(0xffe2b0, 0.66); sun.position.set(60, 90, 30); scene.add(sun);

// Low-res target and upscale (engine plan 0b). The scene is drawn into an internal render target and blitted to the canvas by one nearest-sampled quad at a whole-number scale:
// s = max(2, round(screenHeight / 540)) device pixels per game pixel, internal size ceil(width / s) by ceil(height / s). Every game pixel is the same size; no CSS scaling. HUD and text stay at full resolution.
const INTERNAL_TARGET = 540;
let lowRT = null, maskRT = null, blitScene = null, blitCam = null, blitQuad = null;
const composite = new Composite(renderer); composite.on = detailLevel() !== 'low' && !/[?&]composite=0/.test(location.search);       // the composite path: on at Detail Medium and High, off at Low
const blackTex = new T.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1, T.RGBAFormat); blackTex.needsUpdate = true;
// the post material (engine plan 0c): nearest-sampled scene colour, then the palette snap: the colour is replaced by the nearest entry of the stage's palette (a 3D lookup), blended by `strength` (0 = off, 1 = full). Models, ground and walls get no dither; the strength starts at 0 until the owner has judged an A/B picture.
const blitMat = new T.ShaderMaterial({ glslVersion: T.GLSL3, depthTest: false, depthWrite: false, uniforms: { tScene: { value: null }, tLut: { value: null }, strength: { value: 0 }, tGlow: { value: null }, uGlow: { value: 0 }, uDim: { value: 0 }, uDrain: { value: 0 }, uFlash: { value: new T.Vector4(0, 0, 0, 0) }, uTB: { value: new T.Vector3() }, uTBang: { value: new T.Vector3(0.4, 2.5, 4.6) }, uTBinfo: { value: new T.Vector4(1, 1, 1, 1) }, uDuel: { value: new T.Vector3(0.5, 0.5, 0) }, uTBh: { value: 0 }, uTBc: { value: new T.Color(0xf3e3c2) }, tMask: { value: null }, uImpact: { value: 0 }, uImpInv: { value: 0 }, uImpA: { value: new T.Color(0x141a40) }, uImpB: { value: new T.Color(0xf4f9ff) } },
  vertexShader: 'out vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
  fragmentShader: 'precision highp float; precision highp sampler3D; uniform sampler2D tScene; uniform sampler2D tGlow; uniform sampler3D tLut; uniform float strength; uniform float uGlow; uniform float uDim; uniform float uDrain; uniform vec4 uFlash; uniform vec3 uTB; uniform vec3 uTBang; uniform vec4 uTBinfo; uniform vec3 uDuel; uniform float uTBh; uniform vec3 uTBc; uniform sampler2D tMask; uniform float uImpact; uniform float uImpInv; uniform vec3 uImpA; uniform vec3 uImpB; in vec2 vUv; layout(location = 0) out vec4 outColor; void main() { vec2 uvS = vUv; vec2 px = uTBinfo.xy; if (uTBh > 0.5) { vec2 p = (vUv - uDuel.xy) * px; float rr = length(p), ang = atan(p.y, p.x), t = mod(ang - uTBang.x, 6.2832), r1 = mod(uTBang.y - uTBang.x, 6.2832), r2 = mod(uTBang.z - uTBang.x, 6.2832); int k = t < r1 ? 0 : (t < r2 ? 1 : 2); float sh = k == 0 ? uTB.x : (k == 1 ? uTB.y : uTB.z), ra = k == 0 ? uTBang.x : (k == 1 ? uTBang.y : uTBang.z); if (rr > uDuel.z && sh > 0.0) uvS = vUv - vec2(cos(ra), sin(ra)) * sh / px; } vec4 sc = texture(tScene, uvS); if (uTBh > 0.5 && (texture(tMask, uvS).r > 0.5 || texture(tMask, vUv).r > 0.5)) sc = texture(tScene, vUv); vec3 c = sc.rgb; if (uTBh > 0.5) { vec2 p2 = (vUv - uDuel.xy) * px, q = vUv / uTBinfo.zw - 0.5; if (max(abs(q.x), abs(q.y)) > 0.3) { for (int j = 0; j < 3; j++) { float ra2 = j == 0 ? uTBang.x : (j == 1 ? uTBang.y : uTBang.z); vec2 dr = vec2(cos(ra2), sin(ra2)); float al = dot(p2, dr), pd = abs(p2.x * dr.y - p2.y * dr.x); if (al > 0.0 && pd < (uTB.x > 0.0 ? 1.5 : 0.6)) c = uTBc; } } } if (uGlow > 0.0) c += floor(texture(tGlow, vUv).rgb * 6.0 + 0.5) / 6.0 * uGlow; if (uDrain > 0.0) c = mix(c, vec3(dot(c, vec3(0.299, 0.587, 0.114))), uDrain * step(0.9, sc.a)); c *= 1.0 - uDim * step(0.9, sc.a); c = mix(c, uFlash.rgb, uFlash.a); if (uImpact > 0.5 && length((vUv - uDuel.xy) * uTBinfo.xy) > max(uDuel.z, 1.0)) { float lm = dot(c, vec3(0.299, 0.587, 0.114)); c = uImpInv > 0.5 ? ((sc.a < 0.5 || lm > 0.8) ? uImpB : uImpA) : (lm > 0.42 ? uImpB : uImpA); } if (strength > 0.0) { vec3 q = texture(tLut, clamp(c, 0.0, 1.0) * (31.0 / 32.0) + 0.5 / 32.0).rgb; c = mix(c, q, strength); } outColor = vec4(c, 1.0); }' });
function setPaletteStage(stage) { if (!blitMat.uniforms.tLut.value) { const t = new T.DataTexture3D(buildPaletteLUT(stage), 32, 32, 32); t.format = T.RGBAFormat; t.type = T.UnsignedByteType; t.minFilter = t.magFilter = T.NearestFilter; t.wrapR = t.wrapS = t.wrapT = T.ClampToEdgeWrapping; t.unpackAlignment = 1; t.needsUpdate = true; blitMat.uniforms.tLut.value = t; } else { const t = blitMat.uniforms.tLut.value; t.image.data = buildPaletteLUT(stage); t.needsUpdate = true; } }
function resize() {
  const dpr = window.devicePixelRatio || 1, dw = Math.max(1, Math.round(window.innerWidth * dpr)), dh = Math.max(1, Math.round(window.innerHeight * dpr)), s = Math.max(2, Math.round(dh / INTERNAL_TARGET)), bw = Math.max(1, Math.ceil(dw / s)), bh = Math.max(1, Math.ceil(dh / s));
  renderer.setPixelRatio(1); renderer.setSize(dw, dh, false);
  canvas.style.width = (dw / dpr) + 'px'; canvas.style.height = (dh / dpr) + 'px'; canvas.dataset.block = s; canvas.dataset.internal = bw + 'x' + bh;
  if (!lowRT || lowRT.width !== bw || lowRT.height !== bh) {
    if (lowRT) lowRT.dispose(); if (maskRT) maskRT.dispose(); maskRT = new T.WebGLRenderTarget(bw, bh, { minFilter: T.NearestFilter, magFilter: T.NearestFilter, depthBuffer: true, stencilBuffer: false, generateMipmaps: false }); blitMat.uniforms.tMask.value = maskRT.texture;
    lowRT = new T.WebGLRenderTarget(bw, bh, { minFilter: T.NearestFilter, magFilter: T.NearestFilter, depthBuffer: true, stencilBuffer: true, generateMipmaps: false });
    if (!blitScene) { blitScene = new T.Scene(); blitCam = new T.OrthographicCamera(-1, 1, 1, -1, 0, 1); blitQuad = new T.Mesh(new T.PlaneGeometry(2, 2), blitMat); blitQuad.frustumCulled = false; blitScene.add(blitQuad); }
    blitMat.uniforms.tScene.value = lowRT.texture; composite.resize(bw, bh);
  }
  { const uv = blitQuad.geometry.attributes.uv, u1 = dw / s / bw, v1 = dh / s / bh; uv.setXY(0, 0, 1); uv.setXY(1, u1, 1); uv.setXY(2, 0, 1 - v1); uv.setXY(3, u1, 1 - v1); uv.needsUpdate = true; }       // the quad shows exactly dw/s by dh/s internal pixels (anchored top left: the right column or bottom row may be cropped by one)
  renderer.internalSize = new T.Vector2(bw, bh); camera.aspect = bw / bh; fitFov();
}
const tb = { on: false, t0: 0, fired: false };
function tbTick() { const u = blitMat.uniforms, bw = lowRT.width, bh = lowRT.height, H = actors.own.hole || new T.Vector4(bw / 2, bh / 2, 0, 0); u.uTBinfo.value.set(bw, bh, blitQuad.geometry.attributes.uv.getX(1) || 1, 1 - (blitQuad.geometry.attributes.uv.getY(2) || 0)); u.uTBh.value = tb.on ? 1 : 0; { const oh0 = OWN_UNI.uHole.value; u.uDuel.value.set(oh0.x / bw, oh0.y / bh, oh0.z); } if (!tb.on) return; const oh = OWN_UNI.uHole.value; const t = (performance.now() - tb.t0) / 1000, amt = tb.hold ? 1 : t < 0.1 ? 1 : t < 0.167 ? 1 - (t - 0.1) / 0.067 : 0; u.uTB.value.set(8 * amt, 12 * amt, 16 * amt); }
// the priority mask (Tablebreak frames only): every enemy warning drawn flat white into its own target, so the blit can keep warning pixels where they are and never shift them
const maskMat = new T.MeshBasicMaterial({ color: 0xffffff, side: T.DoubleSide });
function drawFrame() { tbTick(); { const iF = actors.impactFrame; blitMat.uniforms.uImpact.value = iF ? 1 : 0; if (iF) { blitMat.uniforms.uImpInv.value = iF === "fire" ? 0 : 1; blitMat.uniforms.uImpA.value.setHex(iF === "fire" ? 0x3a2a18 : 0x141a40); blitMat.uniforms.uImpB.value.setHex(iF === "fire" ? 0xfff4c8 : 0xf4f9ff); actors.impactFrame = null; } } renderer.setRenderTarget(lowRT); renderer.render(scene, camera); if (tb.on || window.__maskAlways) { const ca = renderer.getClearAlpha(), cc = renderer.getClearColor(new T.Color()).getHex(), lm = camera.layers.mask; renderer.setClearColor(0x000000, 1); const bg = scene.background, fg = scene.fog; scene.background = null; scene.fog = null; camera.layers.set(3); scene.overrideMaterial = maskMat; renderer.setRenderTarget(maskRT); renderer.clear(); renderer.render(scene, camera); scene.overrideMaterial = null; scene.background = bg; scene.fog = fg; camera.layers.mask = lm; renderer.setClearColor(cc, ca); renderer.setRenderTarget(lowRT); } const gl = composite.run(lowRT.texture, lowRT.width, lowRT.height); blitMat.uniforms.tGlow.value = gl || blackTex; blitMat.uniforms.uGlow.value = gl ? 1 : 0; renderer.setRenderTarget(null); renderer.render(blitScene, blitCam); }
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
function applyStageLook(look) { setActorLight(look.actor); setPaletteStage(Math.max(0, STAGE_INDEX_OF(look))); scene.background.setHex(look.sky[1]); scene.fog.color.setHex(look.sky[1]); scene.fog.near = look.fogNear; scene.fog.far = look.fogFar;  }
const STAGE_INDEX_OF = look => STAGE_LOOK_LIST.indexOf(look);
let waterMesh = null, curLook = null, ripT = 0;
const ownPeak = { r: 0, t: 0 }; let capBurstDone = false;
let grassMesh = null, sceneryGroup = null, mapMesh = null, gateSeal = null, viewMapKey = '';
function syncMap() {                                                       // the stage's map was generated by the sim; build its mesh and minimap once
  if (game.map.key === viewMapKey) return; viewMapKey = game.map.key;
  if (mapMesh) { scene.remove(mapMesh); mapMesh.traverse(o => { if (o.geometry) o.geometry.dispose(); }); }
  const look = lookFor(game.mode === 'classic' ? 0 : game.stage || 0); applyStageLook(look);       // the stage's palette: ground, rim, sky and fog, seal
  mapMesh = buildMapMesh(game.map, look); scene.add(mapMesh);
  if (game.map.v2) input.yaw = chooseStartYaw(game.map);       // a designed map: the camera starts turned toward the best view from the spawn (open ground, a landmark or the gate, two tiers; never a wall within 40 m)
  if (waterMesh) { scene.remove(waterMesh); waterMesh.geometry.dispose(); waterMesh = null; } { const pl = poolSpots(game.map); if (pl.length) { waterMesh = buildWater(pl, look); scene.add(waterMesh); } } curLook = look;
    if (gateSeal) scene.remove(gateSeal); gateSeal = buildGateSeal(game.map, look); scene.add(gateSeal);
    if (grassMesh) { scene.remove(grassMesh); grassMesh.geometry.dispose(); grassMesh = null; }
    if (sceneryGroup) { scene.remove(sceneryGroup); sceneryGroup.traverse(o => { if (o.geometry) o.geometry.dispose(); }); sceneryGroup = null; }
    if (!/[?&]scenery=0/.test(location.search)) { sceneryGroup = buildScenery(game.map, game.stage || 0, assets); scene.add(sceneryGroup); setShadeMask(sceneryGroup.userData.mask, look); grassMesh = buildGrass(game.map, game.stage || 0, sceneryGroup.userData.scatter, sceneryGroup.userData.theme); if (grassMesh) scene.add(grassMesh); ambient.setSpots(sceneryGroup.userData.flowerSpots, game.stage || 0, game.map.hash); } else { ambient.clear(); setShadeMask(null, look); } minimap.setMap(game.map);
    try { renderer.compile(scene, camera); } catch (e) { /* warm-up is best effort */ }       // shaders are built behind the stage card, so the first frames do not hitch
}
let duelist = 'kael';
const withProps = /[?&]props/.test(location.search);       // map objects are placed by the coming map generator; ?props shows the region-placed test set
const game = new Game(Date.now() & 0xffff, { duelist, world: withProps ? 'regions' : 'none' });
const host = createBrowserHost(canvas);
const save = loadSave(host);
const fx = new Fx(scene, save.settings);
const actors = new Actors(scene, assets, fx); actors.ownCtx = { camera, renderer };
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
  { const cls = deviceClass(), V = (id, d) => { const v = s[id]; if (v !== undefined) return v; const dv = defaultFor(id, cls); return dv === null || dv === undefined ? d : dv; }; fx.dmgMode = V('damageNumbers', 'all'); fx.gentle = !!s.reduceMotion || (new URLSearchParams(location.search).get('moments') || V('bigMoments', 'full')) !== 'full'; /* Big moments: Full by default; Reduce motion forces Gentle */ window.__dsMarker = V('duelistMarker', true) !== false; input.mult = { pad: V('lookSpeed', 5) / 5, drag: V('dragLook', 5) / 5, mouse: V('mouseLook', 5) / 5 }; const il = V('invertLook', 'none'); input.inv = { pad: { x: il === 'horizontal' || il === 'both', y: il === 'vertical' || il === 'both' }, drag: { x: il === 'horizontal' || il === 'both', y: il === 'vertical' || il === 'both' }, mouse: { x: false, y: !!V('invertMouse', false) } }; window.__dsVib = V('vibration', 70) / 100; }
  window.__dsDetail = s.detail === 'low' || s.detail === 'medium' || s.detail === 'high' ? s.detail : null; composite.on = detailLevel() !== 'low' && !/[?&]composite=0/.test(location.search); for (const el of document.querySelectorAll('.setDetail button')) el.classList.toggle('on', el.dataset.v === detailLevel());       // Detail: Low drops the composite pass and the blade grass; it applies live to the composite and to the next stage's grass
  for (const el of document.querySelectorAll('.setRM')) el.checked = !!s.reduceMotion;
  for (const el of document.querySelectorAll('.setShake')) { el.value = s.shake; el.disabled = !!s.reduceMotion; }
  for (const el of document.querySelectorAll('.setShakeV')) el.textContent = s.reduceMotion ? 'off' : s.shake;
}
function bindSettings() {
  for (const el of document.querySelectorAll('.setRM')) el.onchange = () => { save.settings.reduceMotion = el.checked; applySettings(); writeSave(host, save); };
  for (const el of document.querySelectorAll('.setShake')) { el.oninput = () => { save.settings.shake = +el.value; applySettings(); }; el.onchange = () => writeSave(host, save); }
  for (const el of document.querySelectorAll('.setDetail button')) el.onclick = () => { save.settings.detail = el.dataset.v; applySettings(); writeSave(host, save); };
  for (const el of document.querySelectorAll('.setFps')) el.onchange = () => { save.settings.fpsCap = +el.value; applySettings(); writeSave(host, save); };
  for (const el of document.querySelectorAll('.setFov')) { el.oninput = () => { save.settings.fov = +el.value; applySettings(); }; el.onchange = () => writeSave(host, save); }
  applySettings();
}
bindSettings();

function lock() { if (canvas.requestPointerLock) { try { canvas.requestPointerLock(); } catch (e) {} } }
function setMode(m) {
  MODE = m; input.enabled = m === 'play'; clearRing(); document.body.dataset.mode = m; if (m !== 'play') clearBanners();          // the run HUD hides under the menus (see the data-mode rules in index.html)
  for (const [id, mm] of [['startScreen', 'start'], ['pauseScreen', 'pause'], ['deadScreen', 'dead'], ['offerScreen', 'offer']]) $(id).classList.toggle('on', m === mm);
  if (m !== 'play' && document.pointerLockElement && document.exitPointerLock) document.exitPointerLock();
  $('hint').textContent = m === 'play' && !document.pointerLockElement && !(touch && touch.isTouch) && !firstPad() ? 'Click the map to look around' : ''; if (touch) touch.setEnabled(m === 'play');
  if (m === 'pause') renderPause(game);
  last = 0;
}
function begin(mode, sel) {       // a short loading card first: the stage is drawn by the generator (a few hundred ms), so the card must be on screen before that work starts
  const card = loadingScreen; card.classList.add('on'); requestAnimationFrame(() => requestAnimationFrame(() => { try { beginNow(mode, sel); } finally { card.classList.remove('on'); } }));
}
function beginNow(mode, sel) {
  sel = sel || {}; if (sel.duelist) pickDuelist(sel.duelist);
  game.opts.mode = typeof mode === 'string' ? mode : 'run'; game.opts.world = 'regions'; game.opts.difficulty = sel.difficulty || save.settings.difficulty; game.opts.oaths = sel.oaths || []; game.opts.map = sel.map || 'ruins';
  ended = false; plateIdol = false; sigils.length = 0; lastFusions = 0; holdT = 0; seenSp.clear(); fx.push = 0; capBurstDone = false; tb.on = false; tb.fired = false; fx.dir.newRun(); fx.stopB.log.length = 0; fx.stopB.last = -1e9; fx.stopLog.length = 0; game.opts.meta = simMeta(save.meta); bars.reset(); game.reset(/[?&]seed=(\d+)/.test(location.search) ? +/[?&]seed=(\d+)/.exec(location.search)[1] : Date.now() & 0xffff, duelist); game.acc = 0; input.yaw = 0; input.pitch = 0; chase.reset(); input.keys = {};
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
bindHolds($('pmActions'));       // End run and Restart: a 1.0 s hold with a pointer, or two presses from a pad or keys
for (const t of document.querySelectorAll('#pmTabs [data-pt]')) t.addEventListener('click', () => pauseTab(t.dataset.pt));
$('pmMap').addEventListener('click', () => { qlCur = 'map'; toggleMap(true); });
$('qlClose').addEventListener('click', () => toggleMap(false)); for (const t of document.querySelectorAll('#qlTabs [data-qt]')) t.addEventListener('click', () => qlTab(t.dataset.qt));
$('pmSettings').addEventListener('click', () => { $('pauseScreen').style.display = 'none'; menus.showSettings('game', { inRun: true, back: () => { $('menuScreen').classList.remove('on'); $('pauseScreen').style.display = ''; } }); });
$('pmRestart').addEventListener('click', () => { const o = game.opts; game.endRun(); results(); begin(o.mode, { duelist, difficulty: o.difficulty, oaths: o.oaths, map: o.map }); });       // Restart pays like End run and goes straight to a new run with the same duelist and rules
canvas.addEventListener('mousedown', () => { if (MODE === 'play') lock(); });
document.addEventListener('pointerlockchange', () => {
  if (!document.pointerLockElement && MODE === 'play') setMode('pause');
  else if (MODE === 'play') $('hint').textContent = '';
});
let qlCur = 'map';
function qlTab(t) { qlCur = t; for (const b of document.querySelectorAll('#qlTabs [data-qt]')) b.classList.toggle('sel', b.dataset.qt === t); $('qlMap').style.display = t === 'map' ? 'flex' : 'none'; $('qlBuild').style.display = t === 'build' ? 'block' : 'none'; $('qlStats').style.display = t === 'stats' ? 'block' : 'none'; if (t === 'build') $('qlBuild').innerHTML = matHtml(game); if (t === 'stats') $('qlStats').innerHTML = statRows(game, false); }
function toggleMap(force) { const want = force === undefined ? !mapOpen : force; if (want && MODE !== 'play' && MODE !== 'pause') return; mapOpen = want; $('mapOverlay').style.display = want ? 'flex' : 'none'; if (want) qlTab(qlCur); if (want) { if (document.pointerLockElement && document.exitPointerLock) { /* keep play mode: the overlay pauses the sim */ } } }
window.addEventListener('keydown', e => { if (e.code === 'KeyM' && !e.repeat && (MODE === 'play' || mapOpen)) { e.preventDefault(); toggleMap(); } else if (e.code === 'Escape' && mapOpen) { e.preventDefault(); toggleMap(false); } });
$('minimap').addEventListener('click', () => { if (MODE === 'play') toggleMap(true); }); $('mapOverlay').addEventListener('click', () => toggleMap(false));
let statsOpen = false;
window.addEventListener('keydown', e => { if (e.code === 'Tab' && (MODE === 'play' || MODE === 'pause')) { e.preventDefault(); statsOpen = !statsOpen; drawStatPanel(game, statsOpen); } });
window.addEventListener('keydown', e => {
  if (e.code === 'Escape' && MODE === 'play' && !document.pointerLockElement) setMode('pause');
  if (MODE === 'offer' && !e.repeat) offerKey(game, e.code, menu);
});
// Pad in every mode: Start pauses and resumes, Select opens the map, B backs out, d-pad and stick move the gold ring, A presses, X redraws and Y passes in an offer.
const padEdges = new PadEdges(); let fitN = 0;
// the proof overlay (engine plan 0a): enemies on screen, frames a second (median over 2 s), draw calls, triangles, internal size, WebGL version and the download size. View only; hidden by default.
let proofOn = false; const proofEl = $('proof'), frameMs = [], dl = { mb: null };
function toggleProof() { proofOn = !proofOn; proofEl.classList.toggle('on', proofOn); proofEl.setAttribute('aria-hidden', proofOn ? 'false' : 'true'); }
{ const pe = performance.getEntriesByType ? performance.getEntriesByType('resource') : []; let b = 0; for (const e of pe) b += e.encodedBodySize || e.transferSize || 0; dl.mb = b > 0 ? b / 1048576 : null;       // the build manifest is the target; until one exists, the bytes the page actually fetched
  fetch('build-manifest.json', { cache: 'no-store' }).then(r => (r.ok ? r.json() : null)).then(m => { if (m && typeof m.totalBytes === 'number') dl.mb = m.totalBytes / 1048576; }).catch(() => {}); }
function proofLine() {
  const s = frameMs.slice().sort((a, b) => a - b), med = s.length ? s[s.length >> 1] : 0, r = renderer.info.render, sz = renderer.internalSize;
  return game.enemyCount() + ' enemies  ' + (med > 0 ? (1000 / med).toFixed(0) : '-') + ' fps  ' + r.calls + ' draws  ' + (r.triangles / 1000).toFixed(1) + 'k tris  ' + sz.x + 'x' + sz.y + '  ' + (renderer.capabilities.isWebGL2 ? 'GL2' : 'GL1') + '  ' + (dl.mb === null ? 'dl n/a' : dl.mb.toFixed(1) + ' MB');
}
let proofT = 0, proofTouch = 0;
window.addEventListener('touchstart', e => { if (e.touches.length === 3) { toggleProof(); proofTouch = performance.now(); } }, { passive: true });
window.addEventListener('keydown', e => { if (e.key === 'F9') { e.preventDefault(); toggleProof(); } });
function padFrame(now) {
  const pad = firstPad(), names = padEdges.poll(pad, now / 1000);
  if (names.includes('y') && pad && pad.buttons && pad.buttons[8] && pad.buttons[8].pressed) { toggleProof(); if (mapOpen) toggleMap(false); return; }       // hold Select and press Y
  if (pad && padEdges.any(pad) && touch) touch.padUsed();
  if (!names.length) return;
  const rv = document.getElementById('reveal');
  if (rv) { if (names.includes('a') || names.includes('b') || names.includes('start')) rv.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true })); return; }       // A skips the chest reveal (once you have seen it)
  for (const n of names) padPress(n);
}
function padPress(n) {
  if (mapOpen) { if (n === 'select' || n === 'b') toggleMap(false); else if (n === 'start') { toggleMap(false); setMode('pause'); } else if (n === 'lb' || n === 'rb') { const T = ['map', 'build', 'stats']; qlTab(T[(T.indexOf(qlCur) + (n === 'rb' ? 1 : 2)) % 3]); } return; }
  if (MODE === 'play') {
    if (mapOpen) { if (n === 'select' || n === 'b') toggleMap(false); else if (n === 'start') { toggleMap(false); setMode('pause'); } else if (n === 'lb' || n === 'rb') { const T = ['map', 'build', 'stats']; qlTab(T[(T.indexOf(qlCur) + (n === 'rb' ? 1 : 2)) % 3]); } return; }
    if (n === 'a' || n === 'b') skipIntro();       // the boss name card is skipped by A or B (no prompt is drawn for it)
    if (n === 'start') setMode('pause'); else if (n === 'select') toggleMap(true);
    return;
  }
  if (MODE === 'offer') {
    if (!game.offer) return;
    if (n === 'x') { offerKey(game, 'KeyR', menu); return; } if (n === 'y') { offerKey(game, 'KeyP', menu); return; } if (n === 'b') { offerKey(game, 'KeyL', menu); return; }
    if (offerGuard()) return;                                                         // nothing is taken in the first 0.3 s
  }
  if (MODE === 'pause' && (n === 'start' || n === 'b')) { $('resumeBtn').click(); return; }
  if (n === 'b') { padBack(); return; }
  if (n === 'a') { if (!ringEl()) padMove('down'); else padPressEl(); return; }
  if (n === 'left' || n === 'right') { if (padAdjust(n)) return; }
  if (n === 'up' || n === 'down' || n === 'left' || n === 'right') padMove(n);
}
window.addEventListener('blur', () => { if (MODE === 'play') setMode('pause'); });
// the prompt and the fusion line sit just above the zone bar, and the items list stays clear of it, whatever the bar's height is
function fitHud() {
  const z = $('zones').getBoundingClientRect(); if (!z.width) return;
  const top = innerHeight - z.top, ps = $('prompt'), fu = $('fusion');
  ps.style.bottom = Math.round(top + 8) + 'px'; fu.style.bottom = Math.round(top + 8 + ps.offsetHeight + 4) + 'px';
  const tr = $('topright').getBoundingClientRect(), tl = $('topleft').getBoundingClientRect();     // the minimap hangs under the clock box and the stats list under the LP box, whatever size the text is
  $('minimap').style.setProperty('top', Math.max(Math.round(tr.bottom + 6), document.body.classList.contains('touch') ? 68 : 0) + 'px', 'important');       // on touch the pause button owns the top right corner $('stats').style.top = Math.round(tl.bottom + 6) + 'px';
  // the items list sits beside the zone bar when there is room, else just above it; it never grows into the stats list above it
  const il = $('itemsList'), room = z.left - 64; il.style.overflow = 'hidden';
  const ib = room >= 150 ? 14 : Math.round(top + 8); il.style.bottom = ib + 'px'; il.style.maxWidth = room >= 150 ? Math.round(room) + 'px' : '';
  const st = $('stats'), stb = st.textContent ? st.getBoundingClientRect().bottom : tl.bottom;
  il.style.maxHeight = Math.max(48, Math.round(innerHeight - ib - stb - 30)) + 'px';
}
window.addEventListener('resize', fitHud);
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
    $('dBracket').textContent = tot > 0 && best ? 'Biggest damage boost: ' + BRACKET_NAMES[best] + ' (' + Math.round(BD[best] / tot * 100) + '% of your extra damage)' : ''; }
  { const rows = Object.entries(game.dealtLog).map(([k, a]) => [k, a.reduce((s, v) => s + (v || 0), 0)]).filter(r => r[1] > 0).sort((a, b) => b[1] - a[1]), tot = rows.reduce((s, r) => s + r[1], 0);      // a bar for every source with its share of all the damage you dealt
    $('dShare').innerHTML = tot > 0 ? '<div class="dim" style="margin:6px 0 2px">Damage dealt, by source</div>' + rows.slice(0, 7).map(r => { const p = Math.round(r[1] / tot * 100); return '<div style="display:grid;grid-template-columns:38% 1fr 3.2em;gap:6px;align-items:center;margin:2px 0"><span style="overflow:hidden;white-space:nowrap;text-transform:capitalize">' + r[0].replace(/-/g, ' ') + '</span><span style="background:#2a2036;height:0.9em;display:block"><i style="display:block;height:100%;width:' + Math.max(2, p) + '%;background:#ffd23f"></i></span><span style="text-align:right">' + p + '%</span></div>'; }).join('') : ''; }
  drawHud(game, true); setMode('dead');
}
// count-ups on the results screen (instant with reduce motion)
function countUp(id, to) {
  const el = $(id); if (save.settings.reduceMotion || to < 2) { el.textContent = to; return; }
  const t0 = performance.now(), dur = 700; el.textContent = 0;
  (function step(now) { const u = Math.min(1, (now - t0) / dur); el.textContent = Math.round(to * (1 - (1 - u) * (1 - u))); if (u < 1) requestAnimationFrame(step); })(t0);
}
const KCOL = KIND_LIST.map(k => k.color), PCOL = [0x46e0ff, 0xe0b765, 0xff5a7a];
let lastBlockTick = 0;
const groundY = (x, z) => Math.min(heightAt(x, z), 40);       // the one ground height for marks drawn on the map (view only: sim events carry no y)
function onEvent(type, a, b, c, data) {
  if (actors.rig) { if (type === 'hurt' && !c) actors.rig.overlay('hurt'); else if (type === 'levelup') actors.rig.once('level_up'); else if (type === 'fusionchest') actors.rig.once('fusion'); }      // one-shot poses, played only if the clip exists
  if (type === 'banner') { if (/^This chest costs/.test(data)) tagPulse = performance.now() + 900; else showBanner(keyWords(data, inputMode())); }       // a refused chest pulses its price tag instead of a banner
  else if (type === 'offer') { drawHud(game, true); setMode('offer'); showOffer(game, menu); if (game.mode !== 'classic' && (game.stage || 0) < 2) setTimeout(() => prewarmStage(game.seed, (game.stage || 0) + 1), 60); }       // the next stage is drawn while the player reads the offer
  else if (type === 'levelup') { host.haptic('levelup'); fx.ring(ip.x, ip.y, ip.z, 3.2, 0xffd56a, 0.55); fx.burst(ip.x, ip.y + 1, ip.z, 22, 0xffe08a, 3, 6, 0.22, 0.8, 4); }
  else if (type === 'hit') { actors.hitAt(b, c, data); fx.number(b, Math.min(heightAt(b, c), 40) + 1.7, c, a, data); }       // at the target's own height, not a fixed 1.7 m
  else if (type === 'relic') { fx.ring(a, game.p.y + 0.3, b, 30, 0xffffff, 0.7); fx.ring(a, game.p.y + 0.3, b, 14, 0xffe08a, 0.5); fx.burst(a, game.p.y + 1.2, b, 40, 0xffe08a, 8, 6, 0.3, 0.8, 5); fx.moment('relic', 'B', { shake: 0.35 }); }
  else if (type === 'block') { fx.burst(data.x, data.y, data.z, 5, 0xc8d0e0, 2.6, 1.5, 0.1, 0.22, 8); fx.ring(data.x, data.y, data.z, 0.7, 0xc8d0e0, 0.18); if (performance.now() - lastBlockTick > 90) { lastBlockTick = performance.now(); tone(150, 0.06, 0.05, 'square'); } }      // the Warden's shield took a hit: a small grey spark and a dull tick, nothing else
  else if (type === 'ace') { fx.ring(a, b, c, 4, 0xffd23f, 0.5); fx.moment('ace', 'C'); showBanner('An Ace approaches'); }
  else if (type === 'trophy') { fx.ring(a, b, c, 4.5, 0xffe9a0, 0.6); fx.burst(a, b + 1, c, 24, 0xffe9a0, 3, 6, 0.25, 0.9, 6); fx.moment('trophy', 'C'); }
  else if (type === 'kill') { fx.burst(b, groundY(b, c) + 0.9, c, 6, KCOL[a] || 0xaaaaaa, 3.5, 4, 0.28, 0.55, 14); actors.corpse(a, b, c); }
  else if (type === 'pickup') fx.burst(ip.x, ip.y + 1.1, ip.z, 3, PCOL[a] || 0xffffff, 1.6, 2.5, 0.14, 0.35, 0);
  else if (type === 'hop') { if (!fx.rm_) tone(330 * Math.pow(1.07, Math.min(a, 10)), 0.05, 0.035, 'triangle'); }       // a rising tick for every chained slide hop
  else if (type === 'hurt') { if (!c) host.haptic('hurt'); if (!c) fx.shake(b ? 0.55 : 0.28, true); }       // the player's own cost (c is 1) neither flinches nor shakes
  else if (type === 'announce') sigils.push({ x: b, z: c, until: actors.vt + 6.5, next: 0 });
  else if (type === 'gatewake') { fx.moment('gatewake', 'A', { shake: 0.5 }); fx.beam(game.map.gate.x, 4, game.map.gate.z, 0xffe9a0, 6); fx.ring(game.map.gate.x, 4, game.map.gate.z, 8, 0xffe9a0, 1); }
  else if (type === 'descent') { fx.moment('descent', 'A', { flash: 1, shake: 0.4 }); }
  else if (type === 'stage') { fx.dir.newStage(); fx.moment('stage', 'A', { flash: 0.8 }); }
  else if (type === 'gatedown') { fx.moment('gatedown', 'A', { flash: 0.6, shake: 0.6 }); }
  else if (type === 'bossphase') { fx.moment('bossphase', 'A', { hitstop: 0.06, shake: 0.7, flash: 0.3 }); fx.ring(ip.x, ip.y, ip.z, 8, 0xe8b84a, 0.7); }
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
  for (let i = sigils.length - 1; i >= 0; i--) { const s = sigils[i]; if (now > s.until) { sigils.splice(i, 1); continue; } if (now >= s.next) { s.next = now + 0.5; fx.ring(s.x, groundY(s.x, s.z) + 0.1, s.z, 4, 0xe8b84a, 0.7); } }
  if (game.mode !== 'classic') {
    if (game.circle && now >= (ringMarks.c || 0)) { ringMarks.c = now + 0.5; fx.ring(game.circle.x, groundY(game.circle.x, game.circle.z) + 0.1, game.circle.z, 3.5, 0xc9a3ff, 0.7); }
    if (game.altar && !game.altar.used && now >= (ringMarks.a || 0)) { ringMarks.a = now + 0.5; fx.ring(game.altar.x, groundY(game.altar.x, game.altar.z) + 0.1, game.altar.z, 3.5, 0xffd56a, 0.7); }
  }
}
const seenSp = new Set(), PLATES = { warden: 'THE SEALED WARDEN', idol: 'TWIN JACKAL IDOLS', pharaoh: 'THE HOLLOW PHARAOH' };
let plateIdol = false, fovDirty = false, hopFov = 0, speedLines = 0;
function bossIntro() {                                              // name plate for elites and the boss, plus a 2 s zoom (skipped by A, B, Enter or a tap; no prompt is drawn)
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
{ const NS = 'http://www.w3.org/2000/svg', svg = document.createElementNS(NS, 'svg'); svg.setAttribute('viewBox', '0 0 1000 560'); svg.setAttribute('preserveAspectRatio', 'none'); let sd = 7; const rr = () => { sd = (Math.imul(sd, 1664525) + 1013904223) >>> 0; return sd / 4294967296; };
  const add = (tag, at) => { const e = document.createElementNS(NS, tag); for (const k in at) e.setAttribute(k, at[k]); svg.appendChild(e); return e; };
  add('rect', { x: 14, y: 14, width: 972, height: 532, rx: 14, fill: 'none', stroke: '#f3e6c8', 'stroke-width': 4, 'stroke-opacity': 0.55, 'stroke-dasharray': '170 9 60 5 300 12 90 6' });       // a card frame with breaks in it
  for (let i = 0; i < 18; i++) { const side = i % 4, t = rr(), len = 40 + rr() * 70; let x = side === 0 ? 1000 * t : side === 1 ? 1000 * t : side === 2 ? 14 : 986, y = side === 0 ? 14 : side === 1 ? 546 : 560 * t, d = 'M' + x.toFixed(0) + ' ' + y.toFixed(0); for (let k = 0; k < 4; k++) { x += (side < 2 ? (rr() - 0.5) * 36 : (side === 2 ? 1 : -1) * len / 4); y += (side < 2 ? (side === 0 ? 1 : -1) * len / 4 : (rr() - 0.5) * 36); d += 'L' + x.toFixed(0) + ' ' + y.toFixed(0); } add('path', { d, fill: 'none', stroke: '#c8402c', 'stroke-width': 3, 'stroke-opacity': 0.8, 'stroke-linejoin': 'bevel' }); }       // cracks running in from the frame
  $('lowhp').appendChild(svg); }
// the dev overlay (?dev=1): what the pacing checks read. Enemies on screen, spawns so far, LP %, spawn rate over the last 10 s, level-ups this minute, and the stage clock.
const dev = /[?&]dev=1/.test(location.search) ? (() => { const d = document.createElement('div'); d.id = 'dev'; d.style.cssText = 'position:fixed;left:8px;top:300px;z-index:60;font:13px/1.35 monospace;color:#9fffb0;background:#000b;padding:6px 8px;border:1px solid #3a6a44;pointer-events:none;white-space:pre'; document.body.appendChild(d); return { d, spawn: [], lv: [], last: 0, fr: new T.Frustum(), pm: new T.Matrix4(), lastLevel: 1 }; })() : null;
function devTick(now) {
  if (!dev || now - dev.last < 200) return; dev.last = now; const g = game, e = g.en, t = g.t; dev.pm.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse); dev.fr.setFromProjectionMatrix(dev.pm);
  let onScreen = 0, v = new T.Vector3(); for (let i = 0; i < e.max; i++) if (e.alive[i]) { v.set(e.x[i], e.y[i] + 0.8, e.z[i]); if (dev.fr.containsPoint(v)) onScreen++; }
  dev.spawn.push([t, g.spawned]); while (dev.spawn.length && t - dev.spawn[0][0] > 10) dev.spawn.shift(); const rate = dev.spawn.length > 1 ? (g.spawned - dev.spawn[0][1]) / Math.max(0.5, t - dev.spawn[0][0]) : 0;
  if (g.level > dev.lastLevel) for (let k = dev.lastLevel; k < g.level; k++) dev.lv.push(t); dev.lastLevel = g.level; while (dev.lv.length && t - dev.lv[0] > 60) dev.lv.shift();
  dev.d.textContent = 'enemies on screen ' + onScreen + '\nspawns so far ' + g.spawned + '\nLP ' + Math.round(g.p.hp / g.p.maxHp * 100) + '%\nspawn rate ' + rate.toFixed(2) + '/s\nlevel-ups last 60 s ' + dev.lv.length + '\nstage clock ' + Math.floor(g.sc || 0) + ' s';
}
let lowShown = false, fpsFrames = 0, fpsT = 0, stepMs = 0;
const perf = { frames: 0, t0: 0, worst: 0, lastNow: 0 };
const head = { x: 0, y: 0, z: 0 }, ip = { x: 0, y: 0, z: 0 }, prof = { sim: 0, view: 0, render: 0 };

// Touch: stick, look, buttons, pause, and tap-to-use. A tap picks the nearest usable thing within a thumb's width of the finger.
touch = new TouchControls(input.raw || input, {
  look: (dx, dy) => input.look(dx, dy, 'drag'), onManualMove: () => { autoWalk = null; },
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
const doneAt = new Map();
function landmarkTags() {
  const W = game.world, p = game.p, out = [];
  const add = (o, text, cls, y) => { const dx = o.x - p.x, dz = o.z - p.z, d2 = dx * dx + dz * dz; if (d2 < 30 * 30) out.push({ x: o.x, y: (o.y || 0) + y, z: o.z, text, cls, d2 }); };
  if (W) {
    const spentFor = o => { if (!doneAt.has(o)) doneAt.set(o, performance.now()); return performance.now() - doneAt.get(o) < 3000; };       // a 'used' label fades out after 3 s (the object keeps its used colour)
    for (const s of W.stones || []) if (!s.used || spentFor(s)) add(s, s.used ? 'Witness Stone: used' : 'Witness Stone: 1 free item of 3', s.used ? 'spent' : 'free', 2.1);
    for (const s of W.shrines || []) if (!s.done || spentFor(s)) add(s, s.done ? 'Shrine of Tribute: done' : 'Shrine of Tribute: hold the ring, pick a boon', s.done ? 'spent' : 'free', 2.4);
    if (W.broker) add(W.broker, 'Relic Broker: shop', 'shop', 2.6);
    if (W.altar && (!W.altar.used || spentFor(W.altar))) add(W.altar, W.altar.used ? 'Altar: used' : 'Altar of Tribute: banish or tribute', W.altar.used ? 'spent' : 'seal', 2.4);
    for (const c of W.cchests || []) if (!c.open) { if (c.trophy || c.free) add(c, c.trophy ? 'Trophy Chest: free, open it' : 'Card Chest: free', 'free', 1.9); else { const pr = chestPrice(game); add(c, game.coins >= pr ? 'Card Chest: ' + pr + ' coins' : 'Card Chest: ' + pr + ', need ' + (pr - game.coins) + ' more', game.coins >= pr ? 'shop' : 'poor', 1.9); } }       // the price, gold when you can pay it and muted red when you cannot (the tier stays hidden)
  }
  for (const c of game.chests) if (!c.open) add(c, 'Sealed Chest: free item', 'free', 1.9);
  return out;
}
let bannerUp = false, tagPulse = 0, hiddenT = 0; const mkV = new T.Vector3(); let mkUntil = 0;
// a tag whose anchor cannot be seen from the camera (a wall, a pylon, a trunk or a boulder on the line) is not drawn
function tagBlocked(t) {
  const cx = camera.position.x, cy = camera.position.y, cz = camera.position.z, N = 14, list = game.colliders ? game.colliders.list : null;
  for (let i = 1; i < N; i++) {
    const u = i / N, x = cx + (t.x - cx) * u, y = cy + (t.y - cy) * u, z = cz + (t.z - cz) * u;
    if (Math.abs(x) < 190 && Math.abs(z) < 190 && heightAt(x, z) > y + 0.1 && (t.x - x) * (t.x - x) + (t.z - z) * (t.z - z) > 1.2) return true;
    if (list) for (let k = 0; k < list.length; k++) { const c = list[k], dx = x - c.x, dz = z - c.z; if (dx * dx + dz * dz < c.r * c.r && y < c.top && (t.x - c.x) * (t.x - c.x) + (t.z - c.z) * (t.z - c.z) > c.r * c.r) return true; }
  }
  return false;
}
function drawTags() {
  { const mk = $('duelMarker'), r = actors.own && actors.own.readout, heavy = !!r && (r.areas + r.volumes >= 3 || r.keptSum > 0.08), nowM = performance.now(); if (heavy) mkUntil = nowM + 700; const on = window.__dsMarker !== false && MODE === 'play' && nowM < mkUntil; if (mk) { if (on) { mkV.set(game.p.x, game.p.y + 2.6, game.p.z).project(camera); if (mkV.z < 1) { mk.style.display = 'block'; mk.style.left = ((mkV.x + 1) / 2 * 100) + '%'; mk.style.top = ((1 - mkV.y) / 2 * 100) + '%'; } else mk.style.display = 'none'; } else mk.style.display = 'none'; } }       // the Duelist marker: a small gold chevron over the duelist while the effects are heavy
  { const bn = $('banner'); bannerUp = !!bn && bn.classList.contains('on'); }
  const list = MODE === 'play' && !mapOpen ? landmarkTags() : []; list.sort((a, b) => a.d2 - b.d2); const n = Math.min(6, list.length), host = $('tags'), w = innerWidth, h = innerHeight;
  for (let i = 0; i < Math.max(n, tagEls.length); i++) {
    if (i >= tagEls.length) { const el = document.createElement('div'); el.className = 'wtag'; host.appendChild(el); tagEls.push(el); }
    const el = tagEls[i]; if (i >= n) { el.style.display = 'none'; continue; }
    const t = list[i]; tagV.set(t.x, t.y, t.z).project(camera); if (tagV.z > 1 || tagBlocked(t)) { el.style.display = 'none'; continue; }
    if (bannerUp && (1 - tagV.y) / 2 > 0.12 && (1 - tagV.y) / 2 < 0.31) { el.style.display = 'none'; continue; }       // world labels never draw inside the announcement lane
    { const px = (tagV.x * 0.5 + 0.5) * w, py = (-tagV.y * 0.5 + 0.5) * h; if (px < 14 || px > w - 14 || py < 14 || py > h - 14 || fx._underHud(px, py)) { el.style.display = 'none'; continue; } }       // a label is whole or absent: never cut at an edge, never over a HUD panel
    el.style.display = 'block'; el.className = 'wtag ' + t.cls + (t.cls === 'poor' && performance.now() < tagPulse ? ' pulse' : ''); if (el.textContent !== t.text) el.textContent = t.text; el.style.left = ((tagV.x * 0.5 + 0.5) * w) + 'px'; el.style.top = ((-tagV.y * 0.5 + 0.5) * h) + 'px';
  }
}
// Upload only what changed: an instanced mesh with no instances this frame and last frame is not re-uploaded (its version is put back), and one with instances uploads just the first count rows,
// not the whole pool (a 4000-slot particle mesh with 90 live is 6 KB, not 300 KB). three.js sends an attribute whenever its version moves, so this runs just before the render.
const instMeshes = []; let instStamp = -1;
function trimUploads() {
  if (instStamp !== scene.children.length) { instStamp = scene.children.length; instMeshes.length = 0; scene.traverse(m => { if (m.isInstancedMesh) instMeshes.push(m); }); }
  for (const m of instMeshes) {
    const im = m.instanceMatrix, ic = m.instanceColor, dead = m.count === 0 && m._lastCount === 0;
    if (dead) { if (m._imV !== undefined) im.version = m._imV; if (ic && m._icV !== undefined) ic.version = m._icV; }
    else { im.updateRange.offset = 0; im.updateRange.count = m.count * 16; if (ic) { ic.updateRange.offset = 0; ic.updateRange.count = m.count * 3; } }
    m._lastCount = m.count; m._imV = im.version; m._icV = ic ? ic.version : undefined;
  }
}
function frame(now) {
  requestAnimationFrame(frame);
  if (fpsCap && now - lastRender < 1000 / fpsCap - 2) return; lastRender = now;
  syncMap(); padFrame(now); if (++fitN % 10 === 1) fitHud();
  const dtReal = last ? Math.min(0.1, (now - last) / 1000) : 0;
  let alpha = game.alpha;
  if (MODE === 'play') {
    last = now;
    const s0 = performance.now();
    if (fx.stop > 0) fx.stop -= dtReal;                                   // hit-stop on boss phase breaks: the view waits, the sim keeps its tick count
    if (holdT > 0) holdT -= dtReal;
    if (dtReal > 0 && !frozen && !mapOpen && fx.stop <= 0 && holdT <= 0) {
      // a one-tick press (E) must survive frames that run no sim tick (above 60 fps most frames run none): latch it until a tick has consumed it
      const cmd = input.command(dtReal);
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
    if (game.offer && MODE === 'play') { drawHud(game, true); setMode('offer'); showOffer(game, menu); }       // safety net: the sim is waiting on an offer the screen never opened (its event was lost), so open it from the state
    if (game.over && MODE === 'play') results();
    if (MODE === 'play') { drawHud(game, false); if (statsOpen) drawStatPanel(game, true); }
  }
  const a0 = performance.now(), p = game.p;
  ip.x = p.px + (p.x - p.px) * alpha; ip.y = p.py + (p.y - p.py) * alpha; ip.z = p.pz + (p.z - p.pz) * alpha;
  if (Math.abs(p.x - p.px) > 3 || Math.abs(p.z - p.pz) > 3) { ip.x = p.x; ip.y = p.y; ip.z = p.z; }
  {   // camera: the bigger the nearest big boss, the further back and higher it sits (gate bosses 6x to 10x get the most)
    let big = 0; for (const sp of game.sp) if (sp.alive && !sp.dead && sp.size > big && (sp.x - ip.x) ** 2 + (sp.z - ip.z) ** 2 < 2500) big = sp.size;
    const bossZoom = fx.rm_ ? 1 : 1 + Math.min(0.95, Math.max(0, (big - 4) / 11));
    // own-size pull-back (spec 2.9): R = the largest radius of a persistent own effect (alive at least 1.0 s) or own summon body (half its height); the peak is held for 2.0 s so a pulsing effect does not pump the camera.
    // ownZoom = R / 5.4, capped at a size FLOOR: the duelist never goes under 7.5% of the screen height (cap = dMax / (arm x fovK), dMax = 1.8 m / (2 x minShare x tan(fovV / 2))). Max, not product, with the boss zoom.
    let R = 0; actors.monsters.forEach(m => { const h = (m.userData.size || 0) / 2; if (h > R) R = h; }); for (const o of game.fx) if (o.on && o.owner === 0 && o.dur >= 1 && o.r > R) R = o.r; if (window.__ds && window.__ds.ownRForce) R = window.__ds.ownRForce;
    const nowS = performance.now() / 1000; if (R >= ownPeak.r || nowS - ownPeak.t > 2) { ownPeak.r = R; ownPeak.t = nowS; }
    const arm = Math.hypot(CFG.cam.back, CFG.cam.up), minShare = Math.min(innerWidth, innerHeight) < 600 ? 0.085 : 0.075, dMax = 1.8 / (2 * minShare * Math.tan(baseV * Math.PI / 360)), cap = Math.max(1, dMax / (arm * fovK));
    const ownZoom = Math.max(1, Math.min(cap / Math.max(0.5, chase.spd), ownPeak.r / 5.4));
    chase.zoomCap = cap; chase.zoomRate = fx.rm_ ? 0.5 : 0;
    chase.zoomTo = Math.max(bossZoom, ownZoom);
  }

  if (MODE === 'play') { const dv = new T.Vector3(ip.x, ip.y + 1, ip.z).project(camera); window.__dealFrom = { x: (dv.x + 1) / 2 * innerWidth, y: (1 - dv.y) / 2 * innerHeight }; }       // where the level-up cards fan out from
  devTick(now); bars.tick(dtReal || 0.016, game, document.body.classList.contains('rm'), performance.now());
  chase.cols = game.colliders; chase.fovK = fovK; sky.position.copy(camera.position); if (gateSeal) gateSeal.userData.update(camera.position, performance.now() / 1000); chase.update(ip, input.yaw, input.pitch, dtReal || 0.016);
  if (MODE === 'start' && !(window.__ds && window.__ds.camHold)) { const tc = performance.now() / 1000, ac = 0.7 + tc * 0.06, pc = game.p; camera.position.set(pc.x + Math.sin(ac) * 7.2, pc.y + 2.5 + Math.sin(tc * 0.3) * 0.18, pc.z + Math.cos(ac) * 7.2); const sh = innerWidth > innerHeight * 1.25 ? (document.body.dataset.cam === 'left' ? -3.4 : 0) : 0; camera.lookAt(pc.x - Math.cos(ac) * sh, pc.y + 1.3, pc.z + Math.sin(ac) * sh); }       // the Camp: a slow orbit around the duelist while a menu is up (view only)
  if (window.__ds && window.__ds.camHold) { const h = window.__ds.camHold; camera.position.set(h.x, h.y, h.z); camera.lookAt(h.lx, h.ly, h.lz); }   // test hook: fixed camera for pictures
  updateSee(camera, ip, renderer);                                         // the see-through uniforms, from the unshaken camera and the smoothed duelist
  if (MODE === 'play') ambient.update(dtReal, camera, game.en);
  threads.update(game.mode !== 'classic' && game.map ? game.map.gate : null, ip, MODE === 'play' ? dtReal : 0, camera, MODE === 'play' && game.boss.state === 'idle' && !game.offer);
  fx.applyShake(camera);
  if (fx.push > 0) { fx.push = Math.max(0, fx.push - dtReal); const u = 1 - fx.push / 2; camera.fov = baseV * (1 - 0.24 * Math.sin(Math.PI * Math.min(1, u))); camera.updateProjectionMatrix(); fovDirty = true; }
  else if (fovDirty) { camera.fov = baseV; camera.updateProjectionMatrix(); fovDirty = false; }
  {   // slide-hop feel (view only): the field of view widens up to 6% with the speed bonus, speed lines appear above 1.3x run speed (both off under Reduce motion)
    const R = CFG.player.speed * (1 + game.mods.move), hv = (window.__ds && window.__ds.hv > 0) ? window.__ds.hv : Math.sqrt(game.p.vx * game.p.vx + game.p.vz * game.p.vz), rm = fx.rm_ || MODE !== 'play';       // __ds.hv: a test hook that pretends the duelist is that fast
    const bonus = rm ? 0 : Math.max(0, Math.min(1, (hv / R - 1) / (K.hopCap - 1)));
    hopFov += (bonus - hopFov) * Math.min(1, (dtReal || 0.016) * 6); if (hopFov < 0.001) hopFov = 0;
    if (fx.push <= 0 && !fovDirty && Math.abs(camera.fov - baseV * (1 + 0.06 * hopFov)) > 0.01) { camera.fov = baseV * (1 + 0.06 * hopFov); camera.updateProjectionMatrix(); }
    const sl = rm ? 0 : Math.max(0, Math.min(1, (hv / R - 1.3) / 0.3)) * 0.85; if (Math.abs(sl - speedLines) > 0.01) { speedLines = sl; $('speedlines').style.opacity = sl.toFixed(2); }
  }
  if (!capBurstDone && (game.mods.reach || 0) >= 1.5 - 1e-9) { capBurstDone = true; fx.moment('capburst', 'B', { hitstop: 0.04 }, { once: 'run' }); { const lead = game.field.monsters.find(m => m), D0 = lead && (MONSTERS[lead.id] || FUSIONS[lead.id]), el0 = D0 && D0.elements && D0.elements[0]; actors.capBurst = { t: 0, x: ip.x, y: ip.y, z: ip.z, hex: el0 && RAMP[el0] ? ownColour(el0) : 0xf3e3c2 }; } fx.cardRing(ip.x, ip.y + 0.6, ip.z, 12, 6); showBanner('Reach has hit its cap'); }
  { const t5 = ((game.otStep || 0) > 0 && (game.mods.reach || 0) >= 1.5 - 1e-9) || !!(window.__ds && window.__ds.tier5Force); actors.tier5 = t5;       // the screen tier: Tier 5 (Tablebreak) when Overtime is running and Reach is at its +150% ceiling
    if (t5 && !tb.fired && !(window.__ds && window.__ds.tier5Force === 'quiet')) { tb.fired = true; const gm = fx.moment('tablebreak', 'A', { hitstop: 0.12 }, { once: 'run' }); if (gm.screen) { const sd = (game.seed || 1) * 0.6180339, f1 = sd % 1, f2 = (sd * 7.31) % 1, f3 = (sd * 3.97) % 1, a0 = f1 * 0.9, a1 = a0 + 1.25 + f2 * 0.8, a2 = a1 + 1.25 + f3 * 0.8; blitMat.uniforms.uTBang.value.set(a0, a1, a2); tb.on = true; tb.t0 = performance.now(); } } }
  fx.tick = Math.round(game.t * 60); fx.stage = game.stage || 0; fx.blocked = !!game.offer || mapOpen; fx.camDist = Math.hypot(camera.position.x - ip.x, camera.position.y - ip.y, camera.position.z - ip.z);
  E.pl.value.set(ip.x, ip.y, ip.z); updateEngine(dtReal || 0.016, curLook); ageRipples(dtReal || 0.016);
  if (waterMesh) { waterMesh.userData.update(camera.position); ripT -= dtReal || 0.016; if (ripT <= 0) { const sp = Math.hypot(game.p.vx, game.p.vz); for (const q of poolSpots(game.map)) if (Math.hypot(ip.x - q.x, ip.z - q.z) < q.r + 0.3 && sp > 1) { ripple(ip.x, ip.z, Math.min(1, 0.4 + sp / 14)); ripT = 0.28; } } }       // the duelist's steps in a pool make ripples
  const lpf = game.p.hp / game.p.maxHp, low = MODE === 'play' && !game.over && (lowShown ? lpf <= 0.33 : lpf <= 0.30);       if (low !== lowShown) { lowShown = low; $('lowhp').classList.toggle('on', low); }       // on at 30% of max LP or less, off again above 33%
  head.x = ip.x; head.y = ip.y + 1.5; head.z = ip.z;
  actors.update(game, alpha, camera.position, head, dtReal);
  if (actors.rig && actors.rig.marker) {      // the duelist marker (Auto): a white chevron over the head once the head has been out of sight for 0.5 s; it bobs
    const R = actors.rig; hiddenT = tagBlocked(head) ? hiddenT + (dtReal || 0.016) : 0; const on = hiddenT > 0.5 || window.__ds.markerAlways === true;
    R.marker.visible = on && MODE === 'play'; if (on) R.marker.position.y = 2.55 + Math.sin(performance.now() / 180) * 0.08;
  }
  ringMarks();
  fx.update(dtReal, camera);
  props.cam = camera.position; props.update(game);
  drawTags(); minimap.draw(game, input.yaw); if (mapOpen) minimap.drawFull($('fullmap'), game, input.yaw);
  showFlash(game);
  const a1 = performance.now();
  trimUploads();
  renderer.info.autoReset = false; renderer.info.reset(); drawFrame();       // calls and triangles are summed over every pass of the frame, so a later post pass is counted too
  prof.view = a1 - a0; prof.render = performance.now() - a1;

  if (perf.lastNow) { frameMs.push(now - perf.lastNow); while (frameMs.length > 120) frameMs.shift(); }
  if (proofOn && now - proofT >= 250) { proofT = now; proofEl.textContent = proofLine(); }
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
// debug: the duelist's pixels, alone (everything else hidden) and in the full scene (everything depth-tested and dithered as drawn), as flat id colour in an off-screen target at the buffer size; silhouette is 0 until the stencil silhouette exists
function pxRT(w, h) { if (!pxRT.rt || pxRT.w !== w || pxRT.h !== h) { if (pxRT.rt) pxRT.rt.dispose(); pxRT.rt = new T.WebGLRenderTarget(w, h, { depthBuffer: true, stencilBuffer: true }); pxRT.buf = new Uint8Array(w * h * 4); pxRT.w = w; pxRT.h = h; } return pxRT.rt; }       // one target reused by every call (a new one each call ran the GPU out of memory over 200 calls)
// debug: the median lit lightness (L*) of an object's visible pixels in the real frame, and of the floor in a ring just outside it (the actor readability rule: 12 L* or more)
function measureObject(root, inst) {
  const size = renderer.internalSize, w = size.x, h = size.y, rt = pxRT(w, h), A = new Uint8Array(w * h * 4), B = pxRT.buf; const draw = () => { renderer.setRenderTarget(rt); renderer.render(scene, camera); renderer.readRenderTargetPixels(rt, 0, 0, w, h, B); renderer.setRenderTarget(null); };
  draw(); A.set(B);
  const mag = new T.MeshBasicMaterial({ color: 0xff00ff, fog: false }); mag.skinning = true; const saved = []; const swap = o => { if (o.isMesh) { saved.push([o, o.material]); o.material = mag; } };
  if (inst) swap(inst); else root.traverse(swap); const hid = []; for (const c of scene.children) if (c.userData && c.userData.extra) { hid.push(c); }
  draw(); for (const [o, m] of saved) o.material = m; mag.dispose();
  const L = (r, g, b) => { const f = v => { v /= 255; return v > 0.04045 ? Math.pow((v + 0.055) / 1.055, 2.4) : v / 12.92; }, Y = 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); return 116 * (Y > 0.008856 ? Math.cbrt(Y) : 7.787 * Y + 16 / 116) - 16; };
  const m = new Uint8Array(w * h); let x0 = w, x1 = 0, y0 = h, y1 = 0, n = 0; for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = (y * w + x) * 4; if (B[i] > 200 && B[i + 1] < 60 && B[i + 2] > 200) { m[y * w + x] = 1; n++; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; } }
  if (!n) return { n: 0 }; const body = [], floor = [];
  for (let y = Math.max(0, y0 - 14); y <= Math.min(h - 1, y1 + 14); y++) for (let x = Math.max(0, x0 - 14); x <= Math.min(w - 1, x1 + 14); x++) { const i = (y * w + x) * 4, k = y * w + x; if (m[k]) body.push(L(A[i], A[i + 1], A[i + 2])); else { const near = (x < x0 - 3 || x > x1 + 3 || y < y0 - 3 || y > y1 + 3) ? 1 : 0; if (near && y <= y0 + (y1 - y0) * 0.35 + 0) floor.push(L(A[i], A[i + 1], A[i + 2])); } }
  const med = a => { a.sort((p, q) => p - q); return a.length ? a[a.length >> 1] : 0; }, q = (a, p) => { a.sort((u, v) => u - v); return a.length ? a[Math.floor((a.length - 1) * p)] : 0; };
  return { n, bodyL: +med(body).toFixed(1), darkestL: +q(body, 0.05).toFixed(1), lightestL: +q(body, 0.95).toFixed(1), floorL: +med(floor).toFixed(1), delta: +(med(body) - med(floor)).toFixed(1) };
}
function duelistPixels() {
  const rig = actors.rig; if (!rig) return null;
  const size = renderer.internalSize, w = size.x, h = size.y, rt = pxRT(w, h), buf = pxRT.buf;
  const idMat = new T.MeshBasicMaterial({ color: 0xff00ff, fog: false }); idMat.skinning = true; idMat.stencilWrite = true; idMat.stencilFunc = T.AlwaysStencilFunc; idMat.stencilRef = 1; idMat.stencilZPass = T.ReplaceStencilOp;
  const saved = [], extras = []; rig.group.traverse(o => { if (o.userData.extra) extras.push([o, o.visible]); else if (o.isMesh) { saved.push([o, o.material]); o.material = idMat; } });
  const setExtras = on => { for (const [o] of extras) o.visible = on && o.userData.extra === 'sil'; };
  const count = (kind) => { renderer.setRenderTarget(rt); renderer.render(scene, camera); renderer.readRenderTargetPixels(rt, 0, 0, w, h, buf); renderer.setRenderTarget(null); let n = 0; for (let i = 0; i < buf.length; i += 4) { if (kind === 'sil') { if (buf[i] < 60 && buf[i + 1] > 200 && buf[i + 2] > 200) n++; } else if (buf[i] > 200 && buf[i + 1] < 60 && buf[i + 2] > 200) n++; } return n; };
  setExtras(false);
  const visible = count();
  const silMat = rig.see.sil, silCol = silMat.color.getHex(); setExtras(true); silMat.color.setHex(0x00ffff); const silhouette = count('sil'); silMat.color.setHex(silCol); setExtras(false);
  const keep = new Set(); for (let o = rig.group; o; o = o.parent) keep.add(o);
  const hid = []; scene.children.forEach(c => { if (!keep.has(c) && c.visible) { hid.push(c); c.visible = false; } }); if (rig.group.parent && rig.group.parent !== scene) rig.group.parent.children.forEach(c => { if (!keep.has(c) && c.visible) { hid.push(c); c.visible = false; } });
  const alone = count();
  for (const c of hid) c.visible = true; for (const [o, m] of saved) o.material = m; for (const [o, v] of extras) o.visible = v; idMat.dispose();
  return { alone, visible, silhouette };
}
window.__ds = {
  blitU: blitMat.uniforms, maskRead: () => { const w = maskRT.width, h = maskRT.height, b = new Uint8Array(w * h * 4); renderer.readRenderTargetPixels(maskRT, 0, 0, w, h, b); return { w, h, b: Array.from(b.filter((_, i) => i % 4 === 0)) }; }, tablebreak: hold => { tb.hold = !!hold; tb.fired = true; blitMat.uniforms.uTBang.value.set(0.5, 2.1, 3.9); tb.on = true; tb.t0 = performance.now(); }, composite, get grass() { return grassMesh; }, chaseZoom: () => chase.zoom, chaseCap: () => chase.zoomCap,
  duelistPixels, see: SEE, tagBlocked, menus,
  bars,
  summonPos: () => { const g = actors.monsters.values().next().value; return g ? { x: g.position.x, y: g.position.y, z: g.position.z } : null; },
  measure: kind => { const A = actors; if (kind === 'duelist') return measureObject(A.rig.group); if (kind === 'summon') { const g = A.monsters.values().next().value; return g ? measureObject(g) : { n: 0 }; } if (String(kind).startsWith('enemy')) return measureObject(null, A.kinds[+String(kind).slice(6) || 0].body); return { n: 0 }; },
  renderer, get water() { return waterMesh; }, blitNow: drawFrame, paletteStrength: v => { blitMat.uniforms.strength.value = v; }, rigSil: () => actors.rig.see.sil, rigExtras: () => actors.rig.see.extras, rigMeshCount: () => { let n = 0, x = 0; if (actors.rig) actors.rig.group.traverse(o => { if (o.isMesh) { if (o.userData.extra) x++; else n++; } }); return { bodies: n, extras: x }; },
  fitHud, minimap, props, game, input, chase, touch, pickAndUse, threads, ambient, toggleMap, mapIsOpen: () => mapOpen, cfg: CFG, camera, scene, actors, assets, prof,
  mode: () => MODE,
  start: begin, begin, results, setMode, menus, fx, onEvent, save,
  pickDuelist, freeze: v => { frozen = !!v; },
  yaw: v => { input.yaw = v; },
  drive: (secs, cmd) => { const c = Object.assign({ f: 0, r: 0, yaw: input.yaw, jump: false, dash: false, slide: false, use: false }, cmd || {}); for (let t = 0; t < secs && !game.over && !game.offer; t += 1 / 60) game.step(1 / 60, c); drainEvents(); if (game.over && MODE === 'play') results(); drawHud(game, true); },
  fillSwarm: (n, kind) => { for (let i = 0; i < n; i++) spawnEnemy(game, kind); },
  perfReset: () => { perf.frames = 0; perf.worst = 0; perf.lastNow = 0; perf.t0 = performance.now(); },
  perfRead: () => ({ frames: perf.frames, ms: performance.now() - perf.t0, worstFrameMs: perf.worst })
};
if (/[?&]fxlab\b/.test(location.search)) import('./view/fxlab.js').then(m => m.startLab(window.__ds));



























