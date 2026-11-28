// Duel Summoner, browser entry. Wires the simulation to the view and the UI modes: start, play, pause, offer, results.
import { loadMapModels, blockMerged as blockMergedM, BLOCKS as BLOCKS_M } from './view/models.js';
import { setDressKit, setDressPalette, setParkKit } from './view/openDressing.js';
import { setEnemyModels, setBossModel } from './view/actors.js';
import { THEMES as THEMES_ALL, GYM_KIT } from './data/themes.js';
import { audio, initAudio, setVolumes, play, setMusic, setAmbience, musicTier, carve, stopCarve, preload, beat } from './view/audio.js';
import { cardDef } from './sim/field.js';
import { EL as JEL } from './view/juice.js';
import { themeFor } from './data/themes.js';
import { setGroundTheme } from './view/openMesh.js';
import { addFarSilhouettes } from './view/farsil.js';
import { loadFusionBodies } from './view/chimera.js';
import { CFG } from './data/config.js';
if (/[?&]thor=1/.test(location.search) && window.top === window) location.replace('thor.html' + location.search.replace(/([?&])thor=1&?/, '$1').replace(/[?&]$/, ''));       // ?thor=1: the AYN Thor's two screens at their real sizes, the game on top and the ride panel below (thor.html)
import { K } from './data/tuning.js';
import { Game } from './sim/game.js';
import { Input } from './core/input.js';
import { clock } from './core/util.js';
import { buildMapMesh } from './view/mapMesh.js';
import { chooseStartYaw } from './view/startview.js';
import { prewarmStage } from './gen/v2/stagemap.js';
import { buildGateSeal } from './view/gateseal.js';
import { buildWater, ripple, ageRipples } from './view/water.js';
import { updateEngine, setActorLight, makeSky, setShadeMask, E, MASK } from './view/engine.js';
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
import { bodyIds } from './data/basics.js';
import { RAMP } from './data/fxramp.js';
import { ownColour } from './view/fxcolour.js';
import { LeyThreads } from './view/threads.js';
import { Actors } from './view/actors.js';
import { ChaseCamera } from './view/camera.js';
import { Minimap, setMinimapTheme } from './view/minimap.js';
import { buildDoor } from './view/doorview.js';
import { POWERUPS } from './data/powerups.js';
import { FLIPS, makeRide } from './sim/ride.js';
import { shrineCourse } from './gen/world/world.js';
import { drawHud, showFlash, showBanner, dropBanner, clearBanners, drawStatPanel, inputMode, rideBanked } from './view/hud.js';
import { keyWords } from './ui/prompts.js';
import { renderPause, setTab as pauseTab, bindHolds, matHtml, statRows } from './view/pause.js';
import { deviceClass } from './ui/device.js';
import { defaultFor } from './ui/settings-schema.js';
import { showOffer, offerKey, offerGuard } from './view/offer.js';
import { loadModel, loadPuffTexture, loadBlocks, blocksOn } from './view/models.js';
import { FEEL } from './data/feel.js';
import { feelPanel } from './view/feelpanel.js';
import { spawnEnemy } from './sim/enemies.js';
import { Props } from './view/props.js';
import { quantise, emptyRecord } from './sim/input.js';
import { loadSave, recordRun, writeSave } from './core/save.js';
import { createBrowserHost } from './core/host.js';
import { simMeta, applyRun, unseal, diffUnlocked } from './core/meta.js';
import { showDeckBox, showLibrary } from './view/metaui.js';
import { QUESTS } from './data/meta.js';
import { Fx } from './view/fx.js';
import { Juice } from './view/juice.js';
import { initMenus } from './view/menus.js';
import { bakeDuelist } from './view/portraits.js';
import { initThumbs } from './view/thumbs.js';
import { DIFF_CHIPS, DUELIST_INFO, OATH_BY_ID } from './data/progress.js';
import { SEALS } from './data/seals.js';
import { sealToasts } from './view/sealtoast.js';
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
let fpsCap = 0, lastRender = 0;                     // a setting (30, 60, 90 or 120); a frame that comes sooner than the cap allows is skipped
let fovSetting = 100, baseV = 62, defV = 62;                    // the setting is HORIZONTAL degrees, so it means the same on every screen shape; the vertical angle follows from the aspect and never goes past 88
let fovK = 1, rideFov = 0;
const vOf = (h, a) => { let raw = a < 1 ? 50 + (h - 80) * 1.1 : 2 * Math.atan(Math.tan(h * Math.PI / 360) / a) * 180 / Math.PI; raw = Math.max(40, raw); return raw < 70 ? raw : 70 + 18 * (1 - Math.exp(-(raw - 70) / 18)); };       // horizontal degrees to vertical: exact on wide screens, a straight 50 to 88 ramp on tall ones, and a soft ceiling at 88 so no step of the slider is lost
function fitFov() { const a = Math.max(0.3, camera.aspect || 1.78); baseV = vOf(fovSetting, a); defV = vOf(100, a); fovK = 1;       // the chase arm no longer follows the setting: a wider FOV shows more, a narrower one shows less
  camera.fov = baseV; camera.updateProjectionMatrix(); }
// the look: only the sun is warm; the sky light is cool and its bounce from the ground is warm and dark, so up-faces land near x1.0 R, x0.97 G, x0.90 B
const hemi = new T.HemisphereLight(0xdfe6f0, 0x6a5038, 0.74); scene.add(hemi);
const sun = new T.DirectionalLight(0xffe2b0, 0.66); sun.position.set(60, 90, 30); scene.add(sun);

// Low-res target and upscale (engine plan 0b). The scene is drawn into an internal render target and blitted to the canvas by one nearest-sampled quad at a whole-number scale:
// s = max(2, round(screenHeight / 540)) device pixels per game pixel, internal size ceil(width / s) by ceil(height / s). Every game pixel is the same size; no CSS scaling. HUD and text stay at full resolution.
const INTERNAL_TARGET = 540;
let lowRT = null, maskRT = null, blitScene = null, blitCam = null, blitQuad = null;
const composite = new Composite(renderer); composite.on = detailLevel() !== 'low' && !/[?&]composite=0/.test(location.search);       // the composite path: on at Detail Medium and High, off at Low
const blackTex = new T.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1, T.RGBAFormat); blackTex.needsUpdate = true;
// the post material (engine plan 0c): nearest-sampled scene colour, then the palette snap: the colour is replaced by the nearest entry of the stage's palette (a 3D lookup), blended by `strength` (0 = off, 1 = full). Models, ground and walls get no dither; the strength starts at 0 until the owner has judged an A/B picture.
const blitMat = new T.ShaderMaterial({ glslVersion: T.GLSL3, depthTest: false, depthWrite: false, uniforms: { tScene: { value: null }, tLut: { value: null }, strength: { value: 0 }, tGlow: { value: null }, uGlow: { value: 0 }, uDim: { value: 0 }, uDrain: { value: 0 }, uFlash: { value: new T.Vector4(0, 0, 0, 0) }, uTB: { value: new T.Vector3() }, uTBang: { value: new T.Vector3(0.4, 2.5, 4.6) }, uTBinfo: { value: new T.Vector4(1, 1, 1, 1) }, uDuel: { value: new T.Vector3(0.5, 0.5, 0) }, uTBh: { value: 0 }, uTBc: { value: new T.Color(0xf3e3c2) }, tMask: { value: null }, uImpact: { value: 0 }, uImpInv: { value: 0 }, uImpA: { value: new T.Color(0x141a40) }, uImpB: { value: new T.Color(0xf4f9ff) }, uBeat: { value: 0 }, uVibeT: { value: 0 } },
  vertexShader: 'out vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
  fragmentShader: 'precision highp float; precision highp sampler3D; uniform sampler2D tScene; uniform sampler2D tGlow; uniform sampler3D tLut; uniform float strength; uniform float uGlow; uniform float uDim; uniform float uDrain; uniform vec4 uFlash; uniform vec3 uTB; uniform vec3 uTBang; uniform vec4 uTBinfo; uniform vec3 uDuel; uniform float uTBh; uniform vec3 uTBc; uniform sampler2D tMask; uniform float uImpact; uniform float uImpInv; uniform vec3 uImpA; uniform vec3 uImpB; uniform float uBeat; uniform float uVibeT; in vec2 vUv; layout(location = 0) out vec4 outColor; void main() { vec2 uvS = vUv; vec2 px = uTBinfo.xy; if (uTBh > 0.5) { vec2 p = (vUv - uDuel.xy) * px; float rr = length(p), ang = atan(p.y, p.x), t = mod(ang - uTBang.x, 6.2832), r1 = mod(uTBang.y - uTBang.x, 6.2832), r2 = mod(uTBang.z - uTBang.x, 6.2832); int k = t < r1 ? 0 : (t < r2 ? 1 : 2); float sh = k == 0 ? uTB.x : (k == 1 ? uTB.y : uTB.z), ra = k == 0 ? uTBang.x : (k == 1 ? uTBang.y : uTBang.z); if (rr > uDuel.z && sh > 0.0) uvS = vUv - vec2(cos(ra), sin(ra)) * sh / px; } vec4 sc = texture(tScene, uvS); if (uTBh > 0.5 && (texture(tMask, uvS).r > 0.5 || texture(tMask, vUv).r > 0.5)) sc = texture(tScene, vUv); vec3 c = sc.rgb; if (uTBh > 0.5) { vec2 p2 = (vUv - uDuel.xy) * px, q = vUv / uTBinfo.zw - 0.5; if (max(abs(q.x), abs(q.y)) > 0.3) { for (int j = 0; j < 3; j++) { float ra2 = j == 0 ? uTBang.x : (j == 1 ? uTBang.y : uTBang.z); vec2 dr = vec2(cos(ra2), sin(ra2)); float al = dot(p2, dr), pd = abs(p2.x * dr.y - p2.y * dr.x); if (al > 0.0 && pd < (uTB.x > 0.0 ? 1.5 : 0.6)) c = uTBc; } } } if (uGlow > 0.0) c += floor(texture(tGlow, vUv).rgb * 6.0 + 0.5) / 6.0 * uGlow; if (uDrain > 0.0) c = mix(c, vec3(dot(c, vec3(0.299, 0.587, 0.114))), uDrain * step(0.9, sc.a)); c *= 1.0 - uDim * step(0.9, sc.a); c = mix(c, uFlash.rgb, uFlash.a); if (uImpact > 0.5 && length((vUv - uDuel.xy) * uTBinfo.xy) > max(uDuel.z, 1.0)) { float lm = dot(c, vec3(0.299, 0.587, 0.114)); c = uImpInv > 0.5 ? ((sc.a < 0.5 || lm > 0.8) ? uImpB : uImpA) : (lm > 0.42 ? uImpB : uImpA); } { float lmv = dot(c, vec3(0.299, 0.587, 0.114)); c = mix(vec3(lmv), c, 1.0 + 0.22 * uBeat) * (1.0 + 0.04 * uBeat); c += (0.5 + 0.5 * cos(6.2832 * (vUv.y * 0.6 + vUv.x * 0.35 + uVibeT) + vec3(0.0, 2.1, 4.2))) * 0.07 * smoothstep(0.6, 0.98, lmv) * step(0.9, sc.a); } if (strength > 0.0) { vec3 q = texture(tLut, clamp(c, 0.0, 1.0) * (31.0 / 32.0) + 0.5 / 32.0).rgb; c = mix(c, q, strength); } outColor = vec4(c, 1.0); }' });
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
await loadBlocks(['kael', 'kaelRide', 'mira', 'vesh', 'oren', 'card', 'husk', 'runner', 'seer', 'ram', 'bloat', 'scarab', 'hunter', 'toll', 'warden', 'wyv1', 'wyv2', 'wyv3', 'hat1', 'hat2', 'hat3', 'familiar', 'tyrant', 'newt', 'strix', 'king', 'jackalT', 'jackalC', 'heart', 'power', 'sealstone', 'chestCard', 'chestSealed', 'chestTrophy', 'gem', 'coin', 'cactus', 'tree', 'stonecard', 'beam', 'urn', 'broker', 'shrine', 'spire']);       // the block look, only with ?blocks=1 (files kept out of the repo)
await loadFusionBodies();       // the lab's fused-body engine in the block runtime (a Fusion is drawn as one fused body of its parents); without it, the old models
let bodyT = 0; const bodyAsked = new Set();
let ENEMY_PRE = '';       // the map's model prefix when it has its own enemy bodies
{ const tid = (/[?&](?:map|theme)=([a-z-]+)/.exec(location.search) || [])[1] || 'desert', TH = THEMES_ALL[tid]; if (TH && TH.dressing && TH.dressing.kit) { const pre = TH.kitPrefix !== undefined ? TH.kitPrefix : (TH.setpieces[0] || '').split('-')[0], id = s => (pre ? pre + '-' + s : s), en = pre ? ['swarm', 'rusher', 'flyer', 'shooter', 'charger', 'exploder', 'controller', 'shielded', 'support', 'trickster'].flatMap(j => ['e-' + pre + '-' + j, 'n-' + pre + '-' + j]).concat([1, 2, 3, 4].map(n => 'b-' + pre + '-' + n)) : [], park = ['quarter', 'kicker-card', 'ledge', 'rail'].map(k => id('p-' + k));
  const GYM = /[?&]gym=1/.test(location.search) && TH.id === 'desert';
  await loadMapModels([...TH.dressing.kit, ...TH.far, ...(TH.farRange ? [TH.farRange] : []), ...TH.setpieces, ...en, ...park, ...(GYM ? GYM_KIT : [])]); const pg = k => (BLOCKS_M[k] ? blockMergedM(BLOCKS_M[k]) : null);
  setParkKit({ quarter: pg(park[0]), kicker: pg(park[1]), ledge: pg(park[2]), rail: pg(park[3]) }); setDressKit(TH.dressing.kit.filter(k => BLOCKS_M[k]).map(k => ({ id: k, geo: blockMergedM(BLOCKS_M[k]) })), (GYM ? GYM_KIT : [TH.central, ...TH.setpieces.filter(k => k !== TH.central)]).map(k => (BLOCKS_M[k] ? { id: k, geo: blockMergedM(BLOCKS_M[k]) } : null)));
  if (TH.id !== 'desert') setDressPalette(TH.ground); if (pre) { setEnemyModels(pre, k => !!BLOCKS_M[k]); ENEMY_PRE = pre; } } }       // a map's own kits (structures, far silhouettes, dressing, park pieces, enemies) from the baked models, before the first chunk is built; the desert is the default map
assets.puff = await loadPuffTexture('assets/models/puff.png.b64');                // falls back to a drawn puff if the file is missing

document.addEventListener('contextmenu', e => { if (!/^(INPUT|TEXTAREA)$/.test((e.target || {}).tagName)) e.preventDefault(); });       // no browser menu over the game or its overlays
function applyStageLook(look) { setActorLight(look.actor); setPaletteStage(Math.max(0, STAGE_INDEX_OF(look))); scene.background.setHex(look.sky[1]); scene.fog.color.setHex(look.sky[1]); scene.fog.near = look.fogNear; scene.fog.far = look.fogFar;  }
const STAGE_INDEX_OF = look => STAGE_LOOK_LIST.indexOf(look);
let seaMesh = null, waterMesh = null, curLook = null, ripT = 0;
const ownPeak = { r: 0, t: 0 }; let capBurstDone = false;
let grassMesh = null, sceneryGroup = null, mapMesh = null, gateSeal = null, viewMapKey = '';
// the big desert's movement feel: sand kicks up behind a fast run and sprays off a slide (view only)
let dustAcc = 0, dustT = 0;
function sandDust() {
  const now = performance.now(), dt = Math.min(0.05, (now - (dustT || now)) / 1000); dustT = now; if (!game.map || !game.map.big || MODE !== 'play') return;
  const p = game.p, sp = Math.hypot(p.vx, p.vz); if (!p.grounded || !(sp > 9.6 || (p.sliding && sp > 5))) { dustAcc = 0; return; }
  dustAcc += dt * (p.sliding ? 36 : 14) * Math.min(2, sp / 9);
  while (dustAcc >= 1) { dustAcc--; const bx = p.x - p.vx / sp * 0.6 + (Math.random() - 0.5) * 0.7, bz = p.z - p.vz / sp * 0.6 + (Math.random() - 0.5) * 0.7; fx.burst(bx, p.y + 0.15, bz, 1, p.sliding ? 0xf0d9a6 : 0xe2c48a, 1.3, 1.4, p.sliding ? 0.26 : 0.18, 0.55, 6); }
}
let doorMesh = null, doorKey = '';
function syncDoor() {       // the big desert's door: built when it rises, lifted out of the sand over five seconds
  const d = game.door, key = d && d.state === 'risen' ? game.map.key + '|' + d.x + '|' + d.z : '';
  if (key !== doorKey) { if (doorMesh) { scene.remove(doorMesh); doorMesh.traverse(o => { if (o.geometry) o.geometry.dispose(); }); doorMesh = null; } doorKey = key; if (key) { doorMesh = buildDoor(game.map, d.x, d.z, game.p.x, game.p.z); scene.add(doorMesh); } }
  if (doorMesh) doorMesh.userData.rise(d.t);
}
let startYawDue = false;       // a new run turns the camera to the start view even when its map is the one already built (the menu backdrop with the same seed)
let farSil = null, farKey = null, curTheme = null;
function farTick() { if (!game.map || !game.map.big || farKey === game.map.key + '|' + game.stage) return; farKey = game.map.key + '|' + game.stage; if (farSil) scene.remove(farSil.group); farSil = addFarSilhouettes(scene, (game.seed | 0) + game.stage * 7919, game.map.spawn, groundY, scene.fog.color.getHex(), curTheme); window.__farSil = farSil.list; }       // far silhouettes (world v3 section 7)
function syncMap() {                                                       // the stage's map was generated by the sim; build its mesh and minimap once
  if (startYawDue && game.map) { startYawDue = false; if (game.map.v2) input.yaw = chooseStartYaw(game.map); }
  if (game.map.key === viewMapKey) return; viewMapKey = game.map.key;
  if (mapMesh) { scene.remove(mapMesh); mapMesh.traverse(o => { if (o.geometry) o.geometry.dispose(); }); }
  let look = lookFor(game.mode === 'classic' ? 0 : game.stage || 0);
  if (game.map.big) { const th = curTheme = themeFor(game.opts.theme, game.stage || 0), N = th.now; setGroundTheme(th); setMinimapTheme(th); if (ENEMY_PRE && actors) { const ch = setEnemyModels(ENEMY_PRE, k => !!BLOCKS_M[k], th.time === 'night'), cb = setBossModel('b-' + ENEMY_PRE + '-' + (Math.min(2, game.stage || 0) + 1), k => !!BLOCKS_M[k]); if (ch && actors.rebuildSwarm) actors.rebuildSwarm(); void cb; }       /* the map's night creatures and the stage's own boss body */ setMusic(th.music, th.time); setAmbience(th.ambience + '_' + th.time.toUpperCase()); look = Object.assign({}, lookFor(0), { name: th.id + '-' + th.time, sky: N.sky, fogNear: N.fog[0], fogFar: N.fog[1], dome: N.dome, actor: N.actor }); sun.color.setHex(N.sun.color); sun.intensity = N.sun.k; sun.position.set(60, 20 + 140 * N.sun.elev, 30); hemi.color.setHex(N.hemi[0]); hemi.groundColor.setHex(N.hemi[1]); hemi.intensity = N.hemi[2]; }       // the map theme and its time of day (src/data/themes.js): stage 1 morning, 2 evening, 3 night
  applyStageLook(look);       // the stage's palette: ground, rim, sky and fog, seal
  mapMesh = buildMapMesh(game.map, look); scene.add(mapMesh);
  if (game.map.v2) input.yaw = chooseStartYaw(game.map);       // a designed map: the camera starts turned toward the best view from the spawn (open ground, a landmark or the gate, two tiers; never a wall within 40 m)
  if (waterMesh) { scene.remove(waterMesh); waterMesh.geometry.dispose(); waterMesh = null; } { const pl = poolSpots(game.map); if (pl.length) { waterMesh = buildWater(pl, look); scene.add(waterMesh); } } if (seaMesh) { scene.remove(seaMesh); seaMesh.geometry.dispose(); seaMesh.material.dispose(); seaMesh = null; } if (game.map.waterY !== undefined && curTheme && curTheme.water) { seaMesh = new T.Mesh(new T.PlaneGeometry(9000, 9000).rotateX(-Math.PI / 2), new T.MeshLambertMaterial({ color: curTheme.water[0], transparent: true, opacity: curTheme.water[1], depthWrite: false })); seaMesh.position.y = game.map.waterY; seaMesh.renderOrder = 2; scene.add(seaMesh); }       // the open water of a water map: one sheet at the water level, following the camera
  curLook = look;
    if (gateSeal) scene.remove(gateSeal); gateSeal = buildGateSeal(game.map, look); scene.add(gateSeal);
    if (grassMesh) { scene.remove(grassMesh); grassMesh.geometry.dispose(); grassMesh = null; }
    if (sceneryGroup) { scene.remove(sceneryGroup); sceneryGroup.traverse(o => { if (o.geometry) o.geometry.dispose(); }); sceneryGroup = null; }
    if (!/[?&]scenery=0/.test(location.search)) { sceneryGroup = buildScenery(game.map, game.stage || 0, assets); scene.add(sceneryGroup); setShadeMask(sceneryGroup.userData.mask, look); if (game.map && game.map.open) MASK.ck.value = 0; /* the open desert has no cloud shadows on the sand */ grassMesh = blocksOn ? null : buildGrass(game.map, game.stage || 0, sceneryGroup.userData.scatter, grassTheme(sceneryGroup.userData.theme), null, scene.fog.near); if (grassMesh) scene.add(grassMesh); ambient.setSpots(sceneryGroup.userData.flowerSpots, game.stage || 0, game.map.hash); } else { ambient.clear(); setShadeMask(null, look); } minimap.setMap(game.map);
    camera.far = game.map && game.map.big ? 2600 : game.map && game.map.open ? 1300 : 600; camera.updateProjectionMatrix();       // the open desert shows its far mountains
    try { renderer.compile(scene, camera); } catch (e) { /* warm-up is best effort */ }       // shaders are built behind the stage card, so the first frames do not hitch
}
let duelist = 'kael';
const withProps = /[?&]props/.test(location.search);       // map objects are placed by the coming map generator; ?props shows the region-placed test set
const RUN_OPEN = !/[?&]terrain=classic/.test(location.search), RUN_ARCH = (/[?&]arch=([a-f])/.exec(location.search) || [])[1];
const MENU_SEED = +((/[?&]menuseed=(\d+)/.exec(location.search) || [])[1] || 47514), MENU_ARCH = (/[?&]menuarch=([a-f])/.exec(location.search) || [])[1] || 'f';       // the menu backdrop is always the open desert, from a fixed seed with a good view; runs follow the terrain option as before
const game = new Game(/[?&]seed=(\d+)/.test(location.search) ? +/[?&]seed=(\d+)/.exec(location.search)[1] : MENU_SEED, { duelist, mode: 'run', world: withProps ? 'regions' : 'none', sample: /[?&]sample=1/.test(location.search), terrain: 'open', roster: !/[?&]roster=0/.test(location.search), theme: (/[?&](?:map|theme)=([a-z-]+)/.exec(location.search) || [])[1] || 'desert', card: !/[?&]foot=1/.test(location.search), flow: /[?&]flow=1/.test(location.search) ? 'v1' : 'v2', arch: RUN_ARCH || MENU_ARCH, gym: /[?&]gym=1/.test(location.search) });
const host = createBrowserHost(canvas);
const save = loadSave(host);
initAudio(save.settings).then(ok => { if (ok) { const warm = () => preload(['RD03', 'RD07', 'RD10', 'RD11', 'RD05', 'RD12', 'SF121', 'SF012', 'SF080', 'SF081', 'SF014', 'SF104', 'RD08', 'RD09']); window.addEventListener('pointerdown', warm, { once: true }); window.addEventListener('keydown', warm, { once: true }); } });       // the sound pack (silent without it)
const fx = new Fx(scene, save.settings);
const juice = new Juice(scene, (x, z) => heightAt(x, z));
const actors = new Actors(scene, assets, fx); actors.ownCtx = { camera, renderer };
const ambient = new Ambient(scene, assets.butterflyPrep);
const threads = new LeyThreads(scene, 6);                               // crimson ribbons toward the Gate
const props = new Props(scene);
const chase = new ChaseCamera(camera);
const input = host.input;
const minimap = new Minimap($('minimap'));
syncMap();

let touch = null, autoWalk = null, mapOpen = false;                                        // tap-to-use: walk to a far chest, then open it
const sealToast = sealToasts(showBanner);
let pendingUse = false, MODE = 'start', last = 0, frozen = false, holdT = 0, lastFusions = 0;

// settings: reduce motion turns off shake, hit-stop, flashes, the boss zoom and the follow lag
function applySettings() {
  setVolumes(save.settings || {});
  const s = save.settings; document.body.classList.toggle('rm', !!s.reduceMotion); chase.lag = !s.reduceMotion;
  { const fr = s.frameRate !== undefined ? s.frameRate : defaultFor('frameRate', deviceClass()); fpsCap = [30, 60, 90, 120].includes(+fr) ? +fr : 0; }       // Settings > Frame rate; 'match' (the PC default) runs at the display's own rate: 120 or 144 Hz screens are never held at 60 for (const el of document.querySelectorAll('.setFps')) el.value = fpsCap;
  fovSetting = Math.max(80, Math.min(115, +s.fov || 100)); fitFov(); for (const el of document.querySelectorAll('.setFov')) el.value = fovSetting; for (const el of document.querySelectorAll('.setFovV')) el.textContent = fovSetting;
  { const cls = deviceClass(), V = (id, d) => { const v = s[id]; if (v !== undefined) return v; const dv = defaultFor(id, cls); return dv === null || dv === undefined ? d : dv; }; fx.dmgMode = V('damageNumbers', 'all'); fx.gentle = !!s.reduceMotion || (new URLSearchParams(location.search).get('moments') || V('bigMoments', 'full')) !== 'full'; /* Big moments: Full by default; Reduce motion forces Gentle */ window.__dsMarker = V('duelistMarker', true) !== false; input.mult = { pad: V('lookSpeed', 5) / 5, drag: V('dragLook', 5) / 5, mouse: V('mouseLook', 5) / 5 }; const il = V('invertLook', 'none'); input.inv = { pad: { x: il === 'horizontal' || il === 'both', y: il === 'vertical' || il === 'both' }, drag: { x: il === 'horizontal' || il === 'both', y: il === 'vertical' || il === 'both' }, mouse: { x: false, y: !!V('invertMouse', false) } }; window.__dsVib = V('vibration', 70) / 100; window.__dsRideLayout = V('rideLayout', 'classic'); window.__dsRideHelpers = V('rideHelpers', 'on') !== 'off'; window.__dsRideCam = ({ off: 0, gentle: 1.4, strong: 3 })[V('camAssist', 'gentle')] || 0;       /* Camera assist: on the card the camera eases round behind the heading */ }
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
  MODE = m; input.enabled = m === 'play'; clearRing(); document.body.dataset.mode = m; if (m !== 'play') clearBanners(); if (m === 'start' || m === 'dead') sealToast.clear();          // the run HUD hides under the menus (see the data-mode rules in index.html)
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
  sealToast.clear();
  sel = sel || {}; if (sel.duelist) pickDuelist(sel.duelist);
  game.opts.terrain = RUN_OPEN ? 'open' : undefined; game.opts.arch = RUN_ARCH;       // a run builds its own map; only the menu backdrop is always the open desert
  game.opts.mode = typeof mode === 'string' ? mode : 'run'; game.opts.world = 'regions'; game.opts.difficulty = sel.difficulty || save.settings.difficulty; game.opts.oaths = sel.oaths || []; game.opts.map = sel.map || 'ruins';
  game.opts.rideAssist = inputMode() === 'touch' && window.__dsRideHelpers !== false; game.opts.autoGrind = !(inputMode() === 'touch' && window.__dsRideHelpers === false);       // Riding helpers (touch): landing assist and auto-grind, each off with the setting
  { const owned = save.meta.boards || ['plain-back', 'sun-back', 'tide-back']; game.opts.board = owned.includes(save.meta.board) ? save.meta.board : 'plain-back'; }       // the card back you ride       // Card Riding landing assist: on for touch (Flow x1 and x2 only)
  if (!diffUnlocked(save.meta, game.opts.map, game.opts.difficulty)) { game.opts.difficulty = 'easy'; if (save.settings.difficulty !== 'easy' && !diffUnlocked(save.meta, game.opts.map, save.settings.difficulty)) save.settings.difficulty = 'easy'; }       // a locked difficulty can never be the one played (debug starts and old saves included)
  ended = false; plateIdol = false; sigils.length = 0; lastFusions = 0; holdT = 0; seenSp.clear(); fx.push = 0; capBurstDone = false; tb.on = false; tb.fired = false; fx.dir.newRun(); fx.stopB.log.length = 0; fx.stopB.last = -1e9; fx.stopLog.length = 0; game.opts.meta = simMeta(save.meta); bars.reset(); game.reset(/[?&]seed=(\d+)/.test(location.search) ? +/[?&]seed=(\d+)/.exec(location.search)[1] : Date.now() & 0xffff, duelist); game.acc = 0; input.yaw = 0; input.pitch = 0; startYawDue = true; chase.reset(); input.keys = {};
  for (const m of actors.monsters.values()) scene.remove(m); actors.monsters.clear();
  for (const m of actors.specials.values()) scene.remove(m); actors.specials.clear();
  for (const m of actors.chests.values()) scene.remove(m); actors.chests.clear();
  drawHud(game, true); setMode('play'); lock();
  const blind = !!game.oaths.blind; for (const id of ['minimap', 'boss', 'plate']) $(id).style.visibility = blind ? 'hidden' : '';      // Blind Oath
}
function pickDuelist(id) { duelist = id; }
let _lmKey = '', _lm = null;
function menuLandmark() {       // what the menu camera looks toward: the nearest big mesa 45 to 220 m from the spawn (the gate has no beacon any more); the gate only if there is none
  const m = game.map; if (!m) return null; if (_lmKey === m.key) return _lm; _lmKey = m.key; let best = null, bd = 1e9;
  for (const b of m.blocks || []) { const d = Math.hypot(b.cx - m.spawn.x, b.cz - m.spawn.z); if (b.tone > 0 && b.rz >= 5 && d > 45 && d < 220 && d < bd) { bd = d; best = { x: b.cx, z: b.cz }; } }
  return (_lm = best || (m.gate ? { x: m.gate.x, z: m.gate.z } : null)); }
let freshSeals = [];
initThumbs(renderer);
const portraits = {}; for (const id of Object.keys(actors.rigs)) { const b = bakeDuelist(renderer, actors.rigs[id]); if (b) portraits[id] = b; }       // real-model pictures for the duelist screen, taken once
const menus = initMenus({ save, portraits, freshSeals: () => freshSeals, persist: () => writeSave(host, save), begin, bindSettings: () => { bindSettings(); },
  showDeckBox: () => showDeckBox(save, () => writeSave(host, save), () => menus.showMain()) });
$('restartBtn').addEventListener('click', () => begin(game.opts.mode, { duelist, difficulty: game.opts.difficulty, oaths: game.opts.oaths, map: game.opts.map }));
$('menuBtn').addEventListener('click', () => { setMode('start'); menus.showMain(); });
document.body.dataset.mode = MODE; menus.showMain();       // the run HUD is hidden under the menus from the first frame
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
if (typeof ResizeObserver !== 'undefined') new ResizeObserver(() => fitHud()).observe($('topright'));       /* the clock box grows when goals are added: the minimap follows it */
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
    const report = game.results({ runId: 'ds-' + game.seed + '-' + save.runs }); unlocked = applyRun(save.meta, report); freshSeals = (report.newSeals || []).slice(); for (const q of unlocked) if (q.reward && q.reward.chips) save.starChips += q.reward.chips; writeSave(host, save);
    // the verifiable replay (seed, difficulty, mode, build, the run-length input tape and the final state hash) rides along with the report
    packReplay(game.replayRaw(), typeof CompressionStream !== 'undefined' ? deflateInBrowser : null).then(r => { report.replay = r; host.reportRun(report); const base = boardUrl(save.settings); if (base) sendAndFollow(base, r, t => { $('dBoard').textContent = t; }); }).catch(() => host.reportRun(report));
  }
  $('dSeals').innerHTML = freshSeals.length && ended ? freshSeals.map(id => '<div class="unseal"><span class="sealBig"><i></i><i></i></span><span class="unsealTxt"><b>' + (OATH_BY_ID[id] ? OATH_BY_ID[id].name : id) + ' unsealed</b><br>' + (OATH_BY_ID[id] ? OATH_BY_ID[id].text : '') + '<br><span class="dim">' + (SEALS[id] ? SEALS[id].feat : '') + '</span></span></div>').join('') : '';
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
const KCOL = KIND_LIST.map(k => k.color), PCOL = [0x46e0ff, 0xe0b765, 0xff5a7a, ...Array.from({ length: 9 }, (_, k) => POWERUPS[k + 3].color)];
let lastBlockTick = 0;
const groundY = (x, z) => Math.min(heightAt(x, z), 40);       // the one ground height for marks drawn on the map (view only: sim events carry no y)
// ---- sound: the game's events to the pack's cues (codes from design/art-book/audio.mjs and the pack's README; the mix rules are in mix.json) ----
const SND = { ollie: 'RD03', bail: 'RD11', grind: 'RD05', ride: 'RD01', perfectpop: 'RD04', flowup: 'RD09', banked: 'RD08', levelup: 'SF104', elitefall: 'SF041', bossphase: 'SF075', gatefight: 'SF060', gatedown: 'SF076', reaction: 'SF037', stopper: 'SF071', brace: 'SF123', bracebreak: 'SF037', stagger: 'SF046', surge: 'SF137', descent: 'SF094', special: 'SF110', slamdrop: 'RD10', hurt: 'SF014', fusionchest: 'SF127', trophy: 'SF087' };
const pk = { n: 0, t: 0, coin: 0, ct: 0 };
function soundFor(type, a, b, c, data) {
  if (!audio.ok || !audio.ctx) return; const now = performance.now() / 1000;
  if (type === 'land') { play(c > 9 ? 'RD10' : 'RD07'); return; }
  if (type === 'kill') { play('SF121', { gain: -2 }); return; }
  if (type === 'hit') { play('SF012', { gain: -6 }); return; }
  if (type === 'trick' && /flip|Shuvit|Impossible/i.test(data || '')) { play('RD12'); return; }
  if (type === 'pickup') { if (a === 0) { pk.n = now - pk.t < 0.6 ? pk.n + 1 : 1; pk.t = now; play('SF080', pk.n <= 8 ? { take: pk.n, rate: 1 } : { take: 7 + (pk.n % 2), gain: -4, rate: 1 }); } else if (a === 1) { pk.coin = now - pk.ct < 0.6 ? pk.coin + 1 : 0; pk.ct = now; play('SF081', { rate: Math.pow(2, Math.min(12, pk.coin) / 12) }); } else play('SF082'); return; }       // the XP ladder climbs one note a gem, coins a semitone a coin
  if (type === 'stage') { play('MP01'); return; }
  const code = SND[type]; if (code) play(code);
}
function onEvent(type, a, b, c, data) {
  soundFor(type, a, b, c, data);
  if (actors.rig) { if (type === 'hurt' && !c) actors.rig.overlay('hurt'); else if (type === 'levelup') actors.rig.once('level_up'); else if (type === 'fusionchest') actors.rig.once('fusion'); }      // one-shot poses, played only if the clip exists
  if (type === 'bosscard') { const el = $('bosscard'); if (el) { el.textContent = data; el.classList.add('on'); document.body.classList.add('cardon'); clearTimeout(el._t); el._t = setTimeout(() => { el.classList.remove('on'); document.body.classList.remove('cardon'); }, 2500); } }       // the stage boss's name, in the top third, 2.5 s
  else if (type === 'bannerdrop') dropBanner(data);
  else if (type === 'banked') { rideBanked(data); schoolDid('banked'); }
  else if (type === 'flowup') showBanner('FLOW x' + data);
  else if (type === 'sealcrack') { sealToast.crack(); fx.ring(ip.x, ip.y + 1.2, ip.z, 2.4, 0xb8913f, 0.5); fx.burst(ip.x, ip.y + 1.4, ip.z, 14, 0xd8b86a, 2.6, 3.5, 0.16, 0.6, 5); tone(196, 0.25, 0.05, 'triangle'); }       // a feat broke an Oath seal: the Oath itself is named on the results screen
  else if (type === 'banner') { if (/^This chest costs/.test(data)) tagPulse = performance.now() + 900; else showBanner(keyWords(data, inputMode())); }       // a refused chest pulses its price tag instead of a banner
  else if (type === 'offer') { drawHud(game, true); setMode('offer'); showOffer(game, menu); if (game.mode !== 'classic' && (game.stage || 0) < 2) setTimeout(() => prewarmStage(game.seed, (game.stage || 0) + 1), 60); }       // the next stage is drawn while the player reads the offer
  else if (type === 'levelup') { host.haptic('levelup'); fx.ring(ip.x, ip.y, ip.z, game.big ? 9 : 3.2, 0xffd56a, 0.55); fx.burst(ip.x, ip.y + 1, ip.z, game.big ? 44 : 22, 0xffe08a, game.big ? 5 : 3, 6, 0.22, 0.8, 4); if (game.big) { fx.ring(ip.x, ip.y + 0.1, ip.z, 5, 0xfff2c0, 0.35); fx.shake(0.18); } }       // the level-up nova punches
  else if (type === 'hit') { actors.hitAt(b, c, data); juice.hit(b, heightAt(b, c) + 0.9, c, data >> 1, data & 1); const near = (b - ip.x) * (b - ip.x) + (c - ip.z) * (c - ip.z) < 2.6; fx.number(b, near ? ip.y + 3 : Math.min(heightAt(b, c), 40) + 1.7, c, a, data); }       // a number never sits on the duelist: from an enemy beside him it floats above his head       // at the target's own height, not a fixed 1.7 m
  else if (type === 'relic') { fx.ring(a, game.p.y + 0.3, b, 30, 0xffffff, 0.7); fx.ring(a, game.p.y + 0.3, b, 14, 0xffe08a, 0.5); fx.burst(a, game.p.y + 1.2, b, 40, 0xffe08a, 8, 6, 0.3, 0.8, 5); fx.moment('relic', 'B', { shake: 0.35 }); }
  else if (type === 'block') { fx.burst(data.x, data.y, data.z, 5, 0xc8d0e0, 2.6, 1.5, 0.1, 0.22, 8); fx.ring(data.x, data.y, data.z, 0.7, 0xc8d0e0, 0.18); if (performance.now() - lastBlockTick > 90) { lastBlockTick = performance.now(); tone(150, 0.06, 0.05, 'square'); } }      // the Warden's shield took a hit: a small grey spark and a dull tick, nothing else
  else if (type === 'ace') { fx.ring(a, b, c, 4, 0xffd23f, 0.5); fx.moment('ace', 'C'); showBanner('An Ace approaches'); }
  else if (type === 'trophy') { fx.ring(a, b, c, 4.5, 0xffe9a0, 0.6); fx.burst(a, b + 1, c, 24, 0xffe9a0, 3, 6, 0.25, 0.9, 6); fx.moment('trophy', 'C'); }
  else if (type === 'kill') { const KB = game.big ? 1.7 : 1; juice.kill(b, groundY(b, c) + 0.5, c, KCOL[a] || 0xc8a070); fx.burst(b, groundY(b, c) + 0.9, c, 4, KCOL[a] || 0xaaaaaa, 3.5 * KB, 4, 0.2, 0.35, 22); /* (fewer, smaller, quicker-falling kill bits: the floating grey squares in the owner's shot) */ if (KB > 1) fx.ring(b, groundY(b, c) + 0.3, c, 1.6, KCOL[a] || 0xaaaaaa, 0.22); if (!actors.corpse(a, b, c)) { actors.pop(a, b, c); fx.burst(b, groundY(b, c) + 0.3, c, 5, 0xd8c08a, 2.2, 1.2, 0.25, 0.35, 6); } }       // a quick pop, then sand puffs; the XP gem is already dropped by the sim at the same spot
  else if (type === 'elitefall') fx.hitstop(0.02);       // hit-stop scaled by impact (AI v1 feel table): an elite or Ace kill 0.02 s, a slam kill 0.04 s, a boss stagger 0.06 s, all under the stop budget
  else if (type === 'pickup') { fx.burst(ip.x, ip.y + 1.1, ip.z, 3, PCOL[a] || 0xffffff, 1.6, 2.5, 0.14, 0.35, 0); if (a >= 3) { fx.ring(ip.x, ip.y + 0.3, ip.z, 4.5, PCOL[a], 0.4); fx.burst(ip.x, ip.y + 1.2, ip.z, 16, PCOL[a], 4, 5, 0.22, 0.6, 6); if (a === 10) { fx.ring(ip.x, ip.y + 0.3, ip.z, 30, 0xfff2c0, 0.6); fx.shake(0.3); } } }       // a power-up reads at a glance: a ring and a burst in its own colour, a wide flash for the Seal Burst
  else if (type === 'hop') { if (!fx.rm_) tone(330 * Math.pow(1.07, Math.min(a, 10)), 0.05, 0.035, 'triangle'); }       // a rising tick for every chained slide hop
  else if (type === 'hurt') { if (!c) host.haptic('hurt'); if (!c) fx.shake(b ? 0.55 : 0.28, true); }       // the player's own cost (c is 1) neither flinches nor shakes
  else if (type === 'announce') sigils.push({ x: b, z: c, until: actors.vt + 6.5, next: 0 });
  else if (type === 'landmark') { fx.ring(a, game.p.y + 0.3, b, 12, 0xffe08a, 0.8); fx.burst(a, game.p.y + 1.5, b, 50, 0xffe08a, 7, 6, 0.3, 0.9, 6); fx.shake(0.25); }       // a landmark reached: a golden ring and a fountain of sparks
  else if (type === 'slam') { const rr = c || 6, y0 = groundY(a, b); if (rr < 4.4) { fx.burst(a, y0 + 0.3, b, 10, 0xd9b872, 3, 3, 0.26, 0.5, 6); } else {       // a small bank: a puff of sand, no ring (rings only on a real slam: a combo of about 400 or more)
    fx.ring(a, y0 + 0.2, b, Math.min(rr, 6), 0xffd56a, 0.4); fx.hitstop(FEEL.hit.hitstop); for (let k = 0; k < 1; k++) fx.burst(a, y0 + 0.4, b, 18, k ? 0xd9b872 : 0xffd56a, 4 + Math.min(rr, 6) * 0.5, 5 + k, 0.34, 0.8, 8); fx.shake(Math.min(0.6, 0.22 + rr * 0.03)); } }       // the landing slam: a gold shockwave, chunky sand and sparks, a weighty shake       // the ring at most 6 m and 0.4 s, so it never sweeps over the Flow meter
  else if (type === 'land') { if (c > 9) { rj.punch = 0.12; fx.ring(a, groundY(a, b) + 0.05, b, 2.6, 0xead2a0, 0.45); } }       // a landing from big air: a small camera punch and a thin sand ring
  else if (type === 'brace') { const y = groundY(a, b); fx.ring(a, y + 0.3, b, 2.6, 0x7fd4ff, 1.0); fx.ring(a, y + 1.4, b, 1.8, 0xbfe8ff, 1.0); }       // a line blocker braces: a shield glow, its 1 s tell
  else if (type === 'stagger') { fx.shake(0.12); fx.burst(a, game.p.y + 1, b, 14, 0xfff0d0, 5, 3, 0.25, 0.4, 6); fx.word(a, game.p.y + 2.8, b, 'Stagger', '#ffd0a0'); }
  else if (type === 'bracebreak') { const y = groundY(a, b); fx.burst(a, y + 1.4, b, 40, 0xbfe8ff, 9, 6, 0.4, 0.7, 6); fx.ring(a, y + 0.3, b, 4, 0x7fd4ff, 0.5); fx.word(a, y + 3.2, b, 'Brace Break', '#bfe8ff'); fx.shake(0.15); }       // the brace shatters       // the card hit a big body: a stagger
  else if (type === 'swipe') fx.shake(0.05);       // a Fusion's claws: the swipe is drawn by the sim's fan; a small kick
  else if (type === 'reaction') { const y = Math.min(heightAt(a, b), 40) + 2.6; fx.word(a, y, b, data || '', '#ffe9a8'); fx.burst(a, y - 1.2, b, 14, 0xfff0c0, 5, 4, 0.3, 0.5, 4); fx.shake(0.04); }       // a reaction: its name over the enemy, a spray of light
  else if (type === 'stopper') fx.shake(0.22);       // a show-stopper: one firm shake, inside the comfort limit, no strobe
  else if (type === 'knock') { actors.throwEnemy(a, b, c); fx.shake(0.08); }       // a small enemy ridden through: thrown up and away in an arc       // a small enemy ridden through: thrown up and away
  else if (type === 'bail') { fx.shake(0.22); fx.burst(a, groundY(a, b) + 0.3, b, 16, 0xd9b872, 3, 2, 0.3, 0.6, 6); }
  else if (type === 'ollie') { schoolDid('ollie'); fx.burst(ip.x, ip.y + 0.1, ip.z, 10, 0xe2c48a, 2.4, 1.6, 0.24, 0.45, 6); }
  else if (type === 'ride') { if (a) { fx.burst(ip.x, ip.y + 0.2, ip.z, 14, 0xffe08a, 2.6, 2, 0.22, 0.5, 6); } }
  else if (type === 'crest') { const y0 = groundY(a, b); fx.burst(a, y0 + 0.2, b, 16, 0xe8c890, 3.5, 3, 0.3, 0.6, 7); }       // sand thrown off a crest
  else if (type === 'arch') { const y0 = groundY(a, b); fx.burst(a, y0 + 3.4, b, 10 + (c || 1) * 3, 0xffe08a, 3, 3, 0.26, 0.5, 6); }       // an arch threaded (the ring grows with each)
  else if (type === 'shrineride') { const y0 = groundY(a, b); fx.ring(a, y0 + 0.3, b, 8, 0xfff2c0, 0.6); for (let k = 0; k < 3; k++) fx.burst(a, y0 + 1.2, b, 26, k ? 0xffd56a : 0xfff2c0, 6, 7 + k * 2, 0.34, 0.8, 8); fx.shake(0.3); }
  else if (type === 'loop') { const y0 = groundY(a, b); fx.burst(a, y0 + (c || 5) * 2, b, 24, 0xfff2c0, 5, 3, 0.3, 0.8, 6); }       // round the full pipe
  else if (type === 'flourish') { const y0 = groundY(a, b), el = (c || 0) % 10, fm = Math.floor((c || 0) / 10) % 10, fu = (c || 0) >= 100, col = el === 1 ? 0xff8a30 : el === 2 ? 0x7fe8ff : 0xffd56a, col2 = el === 1 ? 0xffd56a : el === 2 ? 0xeafcff : 0xfff2c0; fx.burst(a, y0 + 0.6, b, 10 + fm * 8 + (fu ? 20 : 0), col, 3 + fm * 1.5 + (fu ? 3 : 0), 4 + fm, 0.28, 0.6, 7); }       // a summon's element on the slam: fire embers or lightning sparks, bigger with its form, a double ring for a Fusion
  else if (type === 'volley') { const y0 = groundY(a, b), k = Math.min(1, Math.max(0, ((c || 600) - 600) / 4000)); if (k > 0.3) { fx.ring(a, y0 + 0.4, b, 6 + 10 * k, 0xffd56a, 0.5 + 0.3 * k); for (let q = 0; q < 2; q++) fx.burst(a, y0 + 2, b, 20 + Math.round(30 * k), q ? 0xffd56a : 0xfff2c0, 4 + 6 * k, 6, 0.32, 0.8, 8); fx.shake(0.15 + 0.35 * k); } }       // a small combo: a quick ring; a big one fills the screen       // the summons all strike with the landing
  else if (type === 'trick') { if (FLIPS.includes(data)) schoolDid('flip'); }
  else if (type === 'cardlit') { const y0 = (c || groundY(a, b)); fx.burst(a, y0, b, 26, 0xffd56a, 5, 6, 0.3, 0.7, 7); }       // a stone card lights for good
  else if (type === 'seal') { const y0 = groundY(a, b); fx.burst(a, y0 + 1, b, 10 + (c || 1) * 4, 0xffe08a, 3, 4, 0.24, 0.5, 6); }       // a seal stone lit (the ring grows with each stone of the set)
  else if (type === 'sealset') { const y0 = groundY(a, b); fx.ring(a, y0 + 0.2, b, 7, 0xfff2c0, 0.7); fx.ring(a, y0 + 0.3, b, 4, 0xffd56a, 0.5); for (let k = 0; k < 3; k++) fx.burst(a, y0 + 1, b, 30, k ? 0xffd56a : 0xfff2c0, 6, 8 + k * 2, 0.36, 0.9, 9); fx.shake(0.35); }       // the whole set: the chest rises
  else if (type === 'grind') { schoolDid('grind'); if (!school().grind) { school().grind = true; writeSave(host, save); } fx.burst(ip.x, ip.y + 0.2, ip.z, 12, 0xffd56a, 3, 3, 0.24, 0.4, 6); }
  else if (type === 'special') { fx.ring(a, game.p.y + 0.3, b, 16, 0xfff2c0, 0.8); fx.burst(a, game.p.y + 1.5, b, 60, 0xffd56a, 9, 7, 0.36, 1, 6); fx.shake(0.6); }
  else if (type === 'procfx') { fx.ring(ip.x, ip.y + 0.2, ip.z, 4.5, 0xffd56a, 0.4); fx.burst(ip.x, ip.y + 1, ip.z, 14, 0xffe08a, 4, 5, 0.22, 0.55, 6); }       // an item's effect fired
  else if (type === 'surge') { fx.shake(0.2); }
  else if (type === 'doorrise') { rumble.t = 3; rumble.x = a; rumble.z = b; rumble.acc = 0; }
  if (type === 'doorrise') { const y0 = Math.min(heightAt(a, b), 40); fx.moment('gatewake', 'A', { shake: 0.45 }); for (let k = 0; k < 4; k++) fx.burst(a + (k - 1.5) * 3, y0 + 0.5, b, 18, 0xd9b872, 3, 3, 0.3, 1.4, 8); fx.ring(a, y0 + 0.3, b, 10, 0xd9b872, 1.4); }       // sand and a low tremor: no beam, no light
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
    if (game.circle && game.circle.portal) { const c = game.circle, p = game.p, dx = c.x - p.x, dz = c.z - p.z, d = Math.hypot(dx, dz) || 1;       // flow v2: the portal, and a red wind toward it within 60 m (no beam)
      if (now >= (ringMarks.p || 0)) { ringMarks.p = now + 0.25; const y = groundY(c.x, c.z); fx.ring(c.x, y + 0.2, c.z, 4.5, 0xff4a3a, 0.6); fx.ring(c.x, y + 1.6, c.z, 3, 0xffb0a0, 0.5); fx.ring(c.x, y + 3.2, c.z, 2.2, 0xff4a3a, 0.5); fx.burst(c.x, y + 1.2, c.z, 6, 0xff5040, 3, 3, 0.25, 0.8, -1); }
      if (d < 60 && d > 5) for (let k = 0; k < 2; k++) { const a = Math.random() * 6.283, r = 2 + Math.random() * 6, x = p.x + Math.cos(a) * r, z = p.z + Math.sin(a) * r; fx.spark(x, p.y + 0.6 + Math.random() * 1.6, z, dx / d * 18, 0.2, dz / d * 18, 0xff5a40, 0.08, 0.45); } }
    if (game.circle && now >= (ringMarks.c || 0)) { ringMarks.c = now + 0.5; fx.ring(game.circle.x, groundY(game.circle.x, game.circle.z) + 0.1, game.circle.z, 3.5, 0xc9a3ff, 0.7); }
    if (game.altar && !game.altar.used && now >= (ringMarks.a || 0)) { ringMarks.a = now + 0.5; fx.ring(game.altar.x, groundY(game.altar.x, game.altar.z) + 0.1, game.altar.z, 3.5, 0xffd56a, 0.7); }
  }
}
const seenSp = new Set(), PLATES = { warden: 'THE SEALED WARDEN', idol: 'TWIN JACKAL IDOLS', pharaoh: 'THE HOLLOW PHARAOH' };
let plateIdol = false, fovDirty = false, hopFov = 0, speedLines = 0;
function bossIntro() {                                              // name plate for elites and the boss, plus a 2 s zoom (skipped by A, B, Enter or a tap; no prompt is drawn)
  for (const sp of game.sp) {
    if (!sp.alive || seenSp.has(sp)) continue; seenSp.add(sp);
    if (game.openFlow) { if (sp.asleep) { seenSp.delete(sp); continue; } if (sp.role === 'gate') fx.push = fx.settings.reduceMotion ? 0 : 2; continue; }       // the open desert: no centre plate; a sleeper has no intro until it wakes (a ribbon says so); the stage boss gets the short push and the card at the top
    if (sp.kind === 'idol') { if (plateIdol) continue; plateIdol = true; }
    const pl = $('plate'); pl.innerHTML = sp.role ? sp.name.toUpperCase() : (PLATES[sp.kind] || ''); pl.classList.remove('on'); void pl.offsetWidth; pl.classList.add('on'); fx.push = fx.settings.reduceMotion ? 0 : 2;
  }
}
const skipIntro = () => { fx.push = 0; };
window.addEventListener('keydown', e => { if (e.code === 'Enter') skipIntro(); }); canvas.addEventListener('pointerdown', skipIntro);
// ride school (the first runs on the big desert): five short chips, each cleared by doing it, about 20 s in all; the beam line just ahead and right of the spawn is there for the grind
const SCHOOL = [['ollie', k => 'Hold ' + k.jump + ', let go: ollie'], ['flip', k => 'In the air: ' + k.dash + ' flips the card'], ['banked', () => 'Land straight: bank it and slam'], ['grind', k => 'Ollie onto the beam to grind (' + k.use + ' snaps onto one)']];
const SCHOOL_KEYS = { keys: { slide: 'C', jump: 'SPACE', dash: 'J', use: 'F' }, pad: { slide: 'RB', jump: 'A', dash: 'B', use: 'X' }, classic: { slide: 'RB', jump: 'A', dash: 'X', use: 'Y' }, touch: { slide: 'SLIDE', jump: 'OLLIE', dash: 'FLIP', use: 'GRIND' } };
const school = () => save.meta.rideSchool || (save.meta.rideSchool = { step: 0, grind: false });       // ride-school progress lives in the save: a fresh save starts the school again
function schoolDid(what) { const S = school(); if (S.step >= SCHOOL.length || SCHOOL[S.step][0] !== what) return; S.step++; writeSave(host, save); if (S.step === SCHOOL.length) showBanner('Ride school done. Chain tricks, keep Flow up.'); }
// the school beams glint gold until the first grind ever
let glintT = 0;
function schoolGlint(dt) { const S = game.big && !school().grind && game.map && game.map.world && game.map.world.school; if (!S || MODE !== 'play') return; glintT -= dt; if (glintT > 0) return; glintT = 0.5; for (const s of S) { const t0 = Math.random(), x = s[0] + (s[2] - s[0]) * t0, z = s[1] + (s[3] - s[1]) * t0, y = groundY(x, z) + 0.75; fx.burst(x, y, z, 9, 0xffe08a, 1.6, 2.2, 0.3, 0.7, 4); fx.ring((s[0] + s[2]) / 2, y - 0.5, (s[1] + s[3]) / 2, 2.6, 0xffd56a, 0.35); } }
function rideHint(riding) { schoolGlint(1 / 60); rumbleTick(1 / 60); const el = document.getElementById('rideHint'); if (!el) return; if (riding) schoolDid('ride'); const on = school().step < SCHOOL.length && game.big && MODE === 'play' && game.t > 0.5; if (el.classList.contains('on') !== on) el.classList.toggle('on', on); if (on) { const im = inputMode(), k = im === 'pad' && window.__dsRideLayout !== 'onfoot' ? SCHOOL_KEYS.classic : SCHOOL_KEYS[im] || SCHOOL_KEYS.keys, txt = SCHOOL[school().step][1](k); if (el.textContent !== txt) el.textContent = txt; } }
// on the card, once the look has been left alone for 0.5 s the camera eases round behind the card's heading (Settings: Camera assist; Gentle by default on phones, Off on handhelds and PC)
const rcam = { yaw: null, idle: 0 };
// ride juice (feel pass, 27 Nov): the camera rolls 2 to 3 degrees into a hard carve and pulls back on a downhill rush; a landing from big air punches it down 0.15 m and back over 0.12 s;
// a hard carve or a powerslide throws voxel sand off the card's back edge. View only.
const rj = { h: null, roll: 0, pull: 0, punch: 0, sprayT: 0 };
// braced line blockers (AI v1): a pale blue shield shell round the body that pulses through the 1 s tell and holds solid while braced, and a ground ring that reads from 40 m. Pooled: one material, eight shells.
const braceFx = { pool: [] };
function braceTick() { const e = game.en; if (!braceFx.mat) { braceFx.mat = new T.MeshBasicMaterial({ color: 0x8fd8ff, transparent: true, opacity: 0.35, depthWrite: false, side: T.DoubleSide }); braceFx.ringMat = new T.MeshBasicMaterial({ color: 0x7fd4ff, transparent: true, opacity: 0.7, depthWrite: false, side: T.DoubleSide }); braceFx.geo = new T.SphereGeometry(1, 16, 10); braceFx.ringGeo = new T.RingGeometry(2.4, 2.8, 32).rotateX(-Math.PI / 2); for (let k = 0; k < 8; k++) { const s = new T.Mesh(braceFx.geo, braceFx.mat), r = new T.Mesh(braceFx.ringGeo, braceFx.ringMat); s.visible = r.visible = false; scene.add(s); scene.add(r); braceFx.pool.push([s, r]); } }
  let n = 0; const now = performance.now() / 1000; if (game.map && game.map.big) for (let i = 0; i < e.max && n < 8; i++) { if (!e.alive[i] || !e.brace || e.brace[i] === 0) continue; const [s, r] = braceFx.pool[n++], tell = e.brace[i] > 0, k = tell ? 0.85 + 0.25 * Math.sin(now * 18) : 1; s.visible = r.visible = true; s.position.set(e.x[i], e.y[i] + 1.4, e.z[i]); s.scale.set(1.9 * k, 2.1 * k, 1.9 * k); r.position.set(e.x[i], groundY(e.x[i], e.z[i]) + 0.12, e.z[i]); r.scale.setScalar(k); }
  for (let k = n; k < 8; k++) { braceFx.pool[k][0].visible = braceFx.pool[k][1].visible = false; } }
// the carve hiss's ground per map (the sound pack's README table); sand when a map is not listed
const CARVE = { desert: 'sand', ash: 'ash', 'ashen-orchard': 'ash', 'frostbound-archive': 'ice', 'kite-steppe': 'grass', 'stormglass-flats': 'glass', sporefen: 'mud', 'dawn-causeway': 'marble', 'starless-vault': 'stone' };
const carveSurface = th => (th && CARVE[th.id]) || 'sand';
// a themed map's grass takes its ground colours (charred on the ash, frosted on the snow); the desert keeps its own
function grassTheme(th) { return curTheme && curTheme.id !== 'desert' ? Object.assign({}, th, { bladeCols: [curTheme.ground.lee, curTheme.ground.tintA], grass: [curTheme.ground.tintA, curTheme.ground.lit] }) : th; }
function rideJuice(dt) {
  if (audio.ctx && game.p && MODE === 'play') { if (curTheme && (!audio.music || audio.music.key !== curTheme.music + '_' + curTheme.time)) { setMusic(curTheme.music, curTheme.time); setAmbience(curTheme.ambience + '_' + curTheme.time.toUpperCase()); } const r0 = game.p.ride; if (r0 && r0.on) carve(carveSurface(curTheme), Math.min(1, r0.speed / 30), r0.pslide ? 1 : 0, !game.p.grounded); else stopCarve(); if (game.rflow) { let alive = 0; const en = game.en; if (en && en.alive) for (let i = 0; i < en.max; i++) if (en.alive[i]) alive++; const heat = alive >= 60 ? 4 : alive >= 25 ? 2 : game.t > 12 ? 1 : 0; musicTier(Math.max(heat, game.rflow.step - 1), game.sp.some(s => s.alive && s.role === 'gate') || game.p.hp < game.p.maxHp * 0.3); } }       // the music grows with the fight, not only with Flow: the full band plays in a horde (owner, 27 Nov: "not even music")       // the card's hiss and the music's tier
  const r = game.p && game.p.ride, p = game.p; if (!r || MODE !== 'play') return;
  if (curTheme && Math.random() < dt * 30) { const W = curTheme.wind, a = Math.random() * 6.283, d = 4 + Math.random() * 14, x = p.x + Math.cos(a) * d, z = p.z + Math.sin(a) * d, y0 = groundY(x, z); if (W.drift === 'embers') fx.spark(x, y0 + 0.3 + Math.random() * 3, z, (Math.random() - 0.5) * 1.5, 1.2 + Math.random() * 1.5, (Math.random() - 0.5) * 1.5, Math.random() < 0.5 ? 0xff7a2a : 0xffc060, 0.07, 1.6); else fx.spark(x, y0 + 0.12, z, 3 * W.strength, 0.05, 1.5 * W.strength, curTheme.now.groundTint && curTheme.time === 'night' ? 0x8a9ad0 : 0xf2d9a8, 0.06, 0.9); }       // what the wind carries over the ground (the theme's drift): sand streams, or rising embers
  let turn = 0; if (r.on && rj.h !== null) { let d = r.heading - rj.h; d = Math.atan2(Math.sin(d), Math.cos(d)); turn = d / Math.max(dt, 1e-3); } rj.h = r.on ? r.heading : null;
  const hard = r.on && p.grounded && (Math.abs(turn) > 1.6 && r.speed > 10 || r.pslide), wantRoll = hard ? Math.max(-0.05, Math.min(0.05, -turn * 0.02)) : 0; rj.roll += (wantRoll - rj.roll) * Math.min(1, dt * 6);
  const down = r.on && p.grounded && r.speed > 18 && p.vy <= 0.01 ? 1 : 0; rj.pull += (down - rj.pull) * Math.min(1, dt * 1.5);
  if (rj.punch > 0) rj.punch = Math.max(0, rj.punch - dt);
  const pk = rj.punch > 0 ? Math.sin(Math.PI * (1 - rj.punch / 0.12)) * 0.15 : 0;
  if (rj.pull > 0.01) { const fx0 = camera.position.x - p.x, fz0 = camera.position.z - p.z, l = Math.hypot(fx0, fz0) || 1; camera.position.x += fx0 / l * 1.6 * rj.pull; camera.position.z += fz0 / l * 1.6 * rj.pull; camera.position.y += 0.5 * rj.pull; }
  camera.position.y -= pk; if (Math.abs(rj.roll) > 1e-4) camera.rotateZ(rj.roll);
  if (hard) { rj.sprayT -= dt; if (rj.sprayT <= 0) { rj.sprayT = 0.04; const bx = p.x - Math.sin(r.heading) * 0.9, bz = p.z - Math.cos(r.heading) * 0.9, side = turn > 0 ? -1 : 1, sx = Math.cos(r.heading) * side, sz = -Math.sin(r.heading) * side; for (let k = 0; k < 3; k++) fx.spark(bx, p.y + 0.15, bz, sx * (4 + Math.random() * 4) - Math.sin(r.heading) * 2, 2 + Math.random() * 3, sz * (4 + Math.random() * 4) - Math.cos(r.heading) * 2, 0xe3bf7e, 0.16, 0.5); } }
}
function rideCam(dt) {
  const r = game.p && game.p.ride, k = window.__dsRideCam === undefined ? 1.4 : window.__dsRideCam; if (rcam.yaw !== null && Math.abs(input.yaw - rcam.yaw) > 1e-5) rcam.idle = 0; else rcam.idle += dt;
  if (r && r.on && k > 0 && rcam.idle > 0.5 && MODE === 'play') { let d = (r.heading + Math.PI) - input.yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); input.yaw += d * Math.min(1, dt * k); }
  rcam.yaw = input.yaw;
}
// the door's rumble: plumes of sand 22 m out on the side the door rose, for 3 s; a direction, never a marker
const rumble = { t: 0, x: 0, z: 0, acc: 0 };
function rumbleTick(dt) { if (rumble.t <= 0 || !game.p) return; rumble.t -= dt; rumble.acc -= dt; if (rumble.acc > 0) return; rumble.acc = 0.3; const p = game.p, dx = rumble.x - p.x, dz = rumble.z - p.z, l = Math.hypot(dx, dz) || 1, side = (Math.random() - 0.5) * 0.5, ux = dx / l, uz = dz / l, px = p.x + (ux - uz * side) * 22, pz = p.z + (uz + ux * side) * 22, y0 = groundY(px, pz); fx.burst(px, y0 + 0.4, pz, 22, 0xd9b872, 5, 7, 0.4, 1.2, 9); fx.shake(0.08); }
// a long jump of the duelist (a debug teleport, a stage change): anything still drawn from the old place to the new one is dropped (sim effects like wakes and bolts, the summons' trail), so no long stretched shape crosses the screen
const tg = { x: null, z: 0 };
function teleGuard() { const p = game.p; if (!p) return; if (tg.x !== null && Math.hypot(p.x - tg.x, p.z - tg.z) > 60) { for (const o of game.fx || []) if (o.on) o.on = false; for (const m of (game.field && game.field.monsters) || []) if (m) { m.x = m.px = p.x; m.z = m.pz = p.z; m.y = m.py = p.y + 2; } } tg.x = p.x; tg.z = p.z; }
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
if (dev) { const a = document.createElement('a'); a.id = 'devSample'; const on = game.opts.sample; a.textContent = on ? 'Sample area: ON (leave)' : 'Sample area'; a.href = location.pathname + (on ? '?dev=1' : '?dev=1&sample=1'); a.style.cssText = 'position:fixed;left:8px;top:270px;z-index:61;font:13px/1.35 monospace;color:#ffe08a;background:#000b;padding:5px 8px;border:1px solid #8a6a2a;text-decoration:none;pointer-events:auto'; document.body.appendChild(a); }       // the Sunken Court sample (a hand-built Stage 1), a dev switch
if (dev) { const a = document.createElement('a'); a.id = 'devOpen'; const on = RUN_OPEN; a.textContent = on ? 'Open desert (the game): switch to the old map' : 'Old map (classic): switch back'; a.href = location.pathname + (on ? '?dev=1&terrain=classic' : '?dev=1'); a.style.cssText = 'position:fixed;left:8px;top:244px;z-index:61;font:13px/1.35 monospace;color:#9fe8ff;background:#000b;padding:5px 8px;border:1px solid #2a6a8a;text-decoration:none;pointer-events:auto'; document.body.appendChild(a); }       // the open terrain preview, a dev switch (add &arch=a..f to pick a landscape)
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
const SHRINE_ASK = { stand: 'Shrine: stand in the ring, pick a boon', ring: 'Ring Shrine: grind a lap of the ring rail (or stand in it)', gate: 'Gate Shrine: ride through all five arches in one go (or stand in it)', bowl: 'Bowl Shrine: ride three laps inside the stones (or stand in it)', spire: 'Spire Shrine: air past the needle above its gold band (or stand in it)', pipe: 'Pipe Shrine: ride a loop of its full pipe (or stand in it)' };
function landmarkTags() {
  const W = game.world, p = game.p, out = [];
  const add = (o, text, cls, y) => { const dx = o.x - p.x, dz = o.z - p.z, d2 = dx * dx + dz * dz; if (d2 < 30 * 30) out.push({ x: o.x, y: (o.y || 0) + y, z: o.z, text, cls, d2 }); };
  if (W) {
    const spentFor = o => { if (!doneAt.has(o)) doneAt.set(o, performance.now()); return performance.now() - doneAt.get(o) < 3000; };       // a 'used' label fades out after 3 s (the object keeps its used colour)
    for (const s of W.stones || []) if (!s.used || spentFor(s)) add(s, s.used ? 'Witness Stone: used' : 'Witness Stone: 1 free item of 3', s.used ? 'spent' : 'free', 2.1);
    for (const s of W.shrines || []) if (!s.done || spentFor(s)) add(s, s.done ? 'Shrine of Tribute: done' : game.big ? (SHRINE_ASK[s.form] || SHRINE_ASK.stand) : 'Shrine of Tribute: hold the ring, pick a boon', s.done ? 'spent' : 'free', 2.4);
    if (W.broker) add(W.broker, 'Relic Broker: shop', 'shop', 2.6);
    if (W.altar && (!W.altar.used || spentFor(W.altar))) add(W.altar, W.altar.used ? 'Altar: used' : 'Altar of Tribute: banish or tribute', W.altar.used ? 'spent' : 'seal', 2.4);
    for (const c of W.cchests || []) if (!c.open) { if (c.trophy || c.free) add(c, c.trophy ? 'Trophy Chest: free, open it' : 'Chest: free', 'free', 1.9); else { const pr = chestPrice(game); add(c, game.coins >= pr ? 'Card Chest: ' + pr + ' coins' : 'Card Chest: ' + pr + ', need ' + (pr - game.coins) + ' more', game.coins >= pr ? 'shop' : 'poor', 1.9); } }       // the price, gold when you can pay it and muted red when you cannot (the tier stays hidden)
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
    el.style.display = 'block'; el.className = 'wtag ' + t.cls + (t.cls === 'poor' && performance.now() < tagPulse ? ' pulse' : ''); if (el.textContent !== t.text) el.textContent = t.text; { const hw = el.offsetWidth / 2 + 10; el.style.left = Math.max(hw, Math.min(w - hw, (tagV.x * 0.5 + 0.5) * w)) + 'px'; } el.style.top = ((-tagV.y * 0.5 + 0.5) * h) + 'px';       // kept 10 px inside the screen edges
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
  syncMap(); farTick(); padFrame(now); if (++fitN % 10 === 1) fitHud();
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
    bossIntro(); { const riding = !!(game.p && game.p.ride && game.p.ride.on); window.__dsRiding = riding; window.__dsBig = !!game.big; touch.setRiding && touch.setRiding(riding); touch.setSpecial && touch.setSpecial(riding && !!(game.rflow && game.rflow.meter >= 1)); touch.setUseVisible((riding || !!game.prompt) && !game.offer); rideHint(riding); }
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
    const arm = Math.hypot(CFG.cam.back, CFG.cam.up), minShare = Math.min(innerWidth, innerHeight) < 600 ? 0.085 : 0.075, dMax = 1.8 / (2 * minShare * Math.tan(defV * Math.PI / 360)), cap = Math.max(1, dMax / (arm * fovK));
    const ownZoom = Math.max(1, Math.min(cap / Math.max(0.5, chase.spd), ownPeak.r / 5.4));
    chase.zoomCap = cap; chase.zoomRate = fx.rm_ ? 0.5 : 0;
    chase.zoomTo = Math.max(bossZoom, ownZoom);
  }

  if (MODE === 'play') { const dv = new T.Vector3(ip.x, ip.y + 1, ip.z).project(camera); window.__dealFrom = { x: (dv.x + 1) / 2 * innerWidth, y: (1 - dv.y) / 2 * innerHeight }; }       // where the level-up cards fan out from
  devTick(now); bars.tick(dtReal || 0.016, game, document.body.classList.contains('rm'), performance.now());
  chase.cols = game.colliders; chase.fovK = fovK; chase.lagT = FEEL.cam.lag; chase.lookAhead = game.p.ride && game.p.ride.on ? FEEL.cam.lookAhead : 0; sky.position.copy(camera.position); if (gateSeal) gateSeal.userData.update(camera.position, performance.now() / 1000); teleGuard(); rideCam(dtReal || 0.016); chase.update(ip, input.yaw, input.pitch, dtReal || 0.016); rideJuice(dtReal || 0.016); braceTick();
  // the menu camera: lower and almost level, so the horizon sits about 47% down and the dunes, the mesa and the gate beam show behind the panels, while Kael stays where he was on screen
  if (MODE === 'start' && game.p && !(game.p.ride && game.p.ride.on)) { game.p.ride = Object.assign(makeRide(), { on: true, heading: game.p.face || 0, speed: 0 }); game.p.grounded = true; }       // the menu: the duelist stands on the hovering card (the ride pose's idle sway), never on foot
  if (MODE === 'start' && !(window.__ds && window.__ds.camHold)) { const tc = performance.now() / 1000, ac = (menuLandmark() ? Math.atan2(game.map.spawn.x - menuLandmark().x, game.map.spawn.z - menuLandmark().z) : 0.7) + Math.sin(tc * 0.08) * 0.5, pc = game.p; camera.position.set(pc.x + Math.sin(ac) * 7.2, pc.y + 1.35 + Math.sin(tc * 0.3) * 0.12, pc.z + Math.cos(ac) * 7.2); const sh = innerWidth > innerHeight * 1.25 ? (document.body.dataset.cam === 'left' ? -3.4 : 0) : 0; camera.lookAt(pc.x - Math.cos(ac) * sh, camera.position.y + 0.42, pc.z + Math.sin(ac) * sh); }       // the Camp: a slow orbit around the duelist while a menu is up (view only)
  if (window.__ds && window.__ds.camHold) { const h = window.__ds.camHold; camera.position.set(h.x, h.y, h.z); camera.lookAt(h.lx, h.ly, h.lz); }   // test hook: fixed camera for pictures
  updateSee(camera, ip, renderer);                                         // the see-through uniforms, from the unshaken camera and the smoothed duelist
  if (MODE === 'play') ambient.update(dtReal, camera, game.en);
  threads.update(game.mode !== 'classic' && game.map ? game.map.gate : null, ip, MODE === 'play' ? dtReal : 0, camera, MODE === 'play' && game.boss.state === 'idle' && !game.offer, !!(game.p && game.p.ride && game.p.ride.on));
  fx.applyShake(camera);
  if (fx.push > 0) { fx.push = Math.max(0, fx.push - dtReal); const u = 1 - fx.push / 2; camera.fov = baseV * (1 - 0.24 * Math.sin(Math.PI * Math.min(1, u))); camera.updateProjectionMatrix(); fovDirty = true; }
  else if (fovDirty) { camera.fov = baseV; camera.updateProjectionMatrix(); fovDirty = false; }
  {   // slide-hop feel (view only): the field of view widens up to 6% with the speed bonus, speed lines appear above 1.3x run speed (both off under Reduce motion)
    const R = CFG.player.speed * (1 + game.mods.move), hv = (window.__ds && window.__ds.hv > 0) ? window.__ds.hv : Math.sqrt(game.p.vx * game.p.vx + game.p.vz * game.p.vz), rm = fx.rm_ || MODE !== 'play';       // __ds.hv: a test hook that pretends the duelist is that fast
    const bonus = rm ? 0 : Math.max(0, Math.min(1, (hv / R - 1) / (K.hopCap - 1)));
    hopFov += (bonus - hopFov) * Math.min(1, (dtReal || 0.016) * 6); if (hopFov < 0.001) hopFov = 0;
    const rd = game.p.ride && game.p.ride.on ? game.p.ride : null, FC = FEEL.cam, rk = rd && !rm ? Math.max(0, Math.min(1, (rd.speed - FEEL.ride.cruise) / Math.max(1, FEEL.ride.top - FEEL.ride.cruise))) : 0; rideFov += (rk - rideFov) * Math.min(1, (dtReal || 0.016) * 4);       // the feel table: on the card the view widens from 70 to 85 degrees with speed
    const fovWant = baseV * (1 + 0.06 * hopFov) * (1 + (FC.fovMax / FC.fovMin - 1) * rideFov);
    if (fx.push <= 0 && !fovDirty && Math.abs(camera.fov - fovWant) > 0.01) { camera.fov = fovWant; camera.updateProjectionMatrix(); }
    const sv = rd ? rd.speed : hv, sl = rm ? 0 : (rd ? Math.max(0, Math.min(1, (sv - FC.speedLines) / 6)) : Math.max(0, Math.min(1, (hv / R - 1.3) / 0.3))) * 0.85;       // speed lines from 18 m/s on the card if (Math.abs(sl - speedLines) > 0.01) { speedLines = sl; $('speedlines').style.opacity = sl.toFixed(2); }
  }
  if (!capBurstDone && (game.mods.reach || 0) >= 1.5 - 1e-9) { capBurstDone = true; fx.moment('capburst', 'B', { hitstop: 0.04 }, { once: 'run' }); { const lead = game.field.monsters.find(m => m), D0 = lead && (MONSTERS[lead.id] || FUSIONS[lead.id]), el0 = D0 && D0.elements && D0.elements[0]; actors.capBurst = { t: 0, x: ip.x, y: ip.y, z: ip.z, hex: el0 && RAMP[el0] ? ownColour(el0) : 0xf3e3c2 }; } fx.cardRing(ip.x, ip.y + 0.6, ip.z, 12, 6); showBanner('Reach has hit its cap'); }
  { const t5 = ((game.otStep || 0) > 0 && (game.mods.reach || 0) >= 1.5 - 1e-9) || !!(window.__ds && window.__ds.tier5Force); actors.tier5 = t5;       // the screen tier: Tier 5 (Tablebreak) when Overtime is running and Reach is at its +150% ceiling
    if (t5 && !tb.fired && !(window.__ds && window.__ds.tier5Force === 'quiet')) { tb.fired = true; const gm = fx.moment('tablebreak', 'A', { hitstop: 0.12 }, { once: 'run' }); if (gm.screen) { const sd = (game.seed || 1) * 0.6180339, f1 = sd % 1, f2 = (sd * 7.31) % 1, f3 = (sd * 3.97) % 1, a0 = f1 * 0.9, a1 = a0 + 1.25 + f2 * 0.8, a2 = a1 + 1.25 + f3 * 0.8; blitMat.uniforms.uTBang.value.set(a0, a1, a2); tb.on = true; tb.t0 = performance.now(); } } }
  fx.tick = Math.round(game.t * 60); fx.stage = game.stage || 0; fx.blocked = !!game.offer || mapOpen; fx.camDist = Math.hypot(camera.position.x - ip.x, camera.position.y - ip.y, camera.position.z - ip.z);
  E.pl.value.set(ip.x, ip.y, ip.z); updateEngine(dtReal || 0.016, curLook); ageRipples(dtReal || 0.016);
  if ((bodyT -= dtReal || 0.016) <= 0) { bodyT = 0.25; const want = []; const add = id => { for (const k of bodyIds(id)) if (!BLOCKS_M[k] && !bodyAsked.has(k)) { bodyAsked.add(k); want.push(k); } const F = FUSIONS[id]; if (F && F.from) F.from.forEach(add); }; if (game.offer && game.offer.cards) for (const c of game.offer.cards) add(c.id); if (game.field) for (const m of game.field.monsters) if (m) add(m.id); if (want.length) loadMapModels(want); }       // the bodies of the summons on offer and on the field are fetched as soon as they show up (three small files each)
  if (seaMesh) seaMesh.position.set(Math.round(camera.position.x / 64) * 64, game.map.waterY, Math.round(camera.position.z / 64) * 64);
  if (waterMesh) { waterMesh.userData.update(camera.position); ripT -= dtReal || 0.016; if (ripT <= 0) { const sp = Math.hypot(game.p.vx, game.p.vz); for (const q of poolSpots(game.map)) if (Math.hypot(ip.x - q.x, ip.z - q.z) < q.r + 0.3 && sp > 1) { ripple(ip.x, ip.z, Math.min(1, 0.4 + sp / 14)); ripT = 0.28; } } }       // the duelist's steps in a pool make ripples
  const lpf = game.p.hp / game.p.maxHp, low = MODE === 'play' && !game.over && (lowShown ? lpf <= 0.33 : lpf <= 0.30);       if (low !== lowShown) { lowShown = low; $('lowhp').classList.toggle('on', low); }       // on at 30% of max LP or less, off again above 33%
  head.x = ip.x; head.y = ip.y + 1.5; head.z = ip.z;
  actors.update(game, alpha, camera.position, head, dtReal);
  if (actors.rig && actors.rig.marker) {      // the duelist marker (Auto): a white chevron over the head once the head has been out of sight for 0.5 s; it bobs
    const R = actors.rig; hiddenT = tagBlocked(head) ? hiddenT + (dtReal || 0.016) : 0; const on = hiddenT > 0.5 || window.__ds.markerAlways === true;
    R.marker.visible = on && MODE === 'play'; if (on) R.marker.position.y = 2.55 + Math.sin(performance.now() / 180) * 0.08;
  }
  ringMarks();
  { const B = beat(), rm = save.settings.reduceMotion; blitMat.uniforms.uBeat.value = rm ? 0 : B.pulse; blitMat.uniforms.uVibeT.value = (performance.now() / 1000 * 0.03) % 1; document.documentElement.style.setProperty('--beat', B.pulse.toFixed(2)); juice.ledBegin(B.pulse);
    if (MODE === 'play' && game.field) for (const m of game.field.monsters || []) { if (!m) continue; const d = cardDef(m.id), el = d && d.elements && d.elements[0], S = JEL[el]; juice.led(m.x, heightAt(m.x, m.z) + 0.08, m.z, 1.1, S ? S.b : 0xffd56a); } if (MODE === 'play' && game.p) juice.led(game.p.x, heightAt(game.p.x, game.p.z) + 0.08, game.p.z, 1.3, 0x46e0ff); juice.ledEnd(); }       // the beat look: the screen breathes with the beat, and every summon and the card ride a neon ring in their element's colour
  for (const o of game.fx || []) if (o.on) juice.rec(o); juice.amount = save.settings.reduceMotion ? 0.4 : 1; juice.update(Math.min(0.05, dtReal || 0.016));
  fx.update(dtReal, camera);
  props.cam = camera.position; props.update(game);
  syncDoor(); sandDust(); drawTags(); minimap.draw(game, input.yaw); if (mapOpen) minimap.drawFull($('fullmap'), game, input.yaw);
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
feelPanel();       // the feel sliders (?debug) and the gym control card (?gym=1)
window.__ds = {
  toggleMap: v => toggleMap(v),       // the Thor bottom screen opens the full map from its small map
  // debug lists for walking to the riding landforms: every full pipe within r metres of the start, and the two great drops (x, z, and which way the drop faces)
  pipes: (r = 2000) => { const m = game.map, sp = m.world && m.world.spawn; if (!sp || !m.big) return []; const out = []; for (let qz = Math.floor((sp.z - r) / 256); qz <= Math.floor((sp.z + r) / 256); qz++) for (let qx = Math.floor((sp.x - r) / 256); qx <= Math.floor((sp.x + r) / 256); qx++) for (const q of m.dressCell(qx, qz).pipes || []) out.push({ x: q[0], z: q[2], radius: q[5], dist: Math.round(Math.hypot(q[0] - sp.x, q[2] - sp.z)) }); return out.sort((a, b) => a.dist - b.dist); },
  drops: () => { const m = game.map, W = m.world; return W && W.drops ? W.drops.map(d => ({ x: Math.round(d.x), z: Math.round(d.z), faceX: +d.c.toFixed(2), faceZ: +d.s.toFixed(2), shelf: +d.H.toFixed(1) })) : []; },
  blitU: blitMat.uniforms, maskRead: () => { const w = maskRT.width, h = maskRT.height, b = new Uint8Array(w * h * 4); renderer.readRenderTargetPixels(maskRT, 0, 0, w, h, b); return { w, h, b: Array.from(b.filter((_, i) => i % 4 === 0)) }; }, tablebreak: hold => { tb.hold = !!hold; tb.fired = true; blitMat.uniforms.uTBang.value.set(0.5, 2.1, 3.9); tb.on = true; tb.t0 = performance.now(); }, composite, get grass() { return grassMesh; }, chaseZoom: () => chase.zoom, chaseCap: () => chase.zoomCap,
  duelistPixels, see: SEE, tagBlocked, menus, scene,       // (scene: a test hook for the block look checks)
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
  setFov: v => { save.settings.fov = v; applySettings(); },
  unseal: ids => { unseal(save.meta, ids); freshSeals = ids.slice(); },
  fillSwarm: (n, kind) => { for (let i = 0; i < n; i++) spawnEnemy(game, kind); },
  perfReset: () => { perf.frames = 0; perf.worst = 0; perf.lastNow = 0; perf.t0 = performance.now(); },
  perfRead: () => ({ frames: perf.frames, ms: performance.now() - perf.t0, worstFrameMs: perf.worst }),
  renderRead: () => ({ calls: renderer.info.render.calls, tris: renderer.info.render.triangles })       // test hook: draw calls and triangles of the last frame (all passes)
};
if (/[?&]fxlab\b/.test(location.search)) import('./view/fxlab.js').then(m => m.startLab(window.__ds));



























