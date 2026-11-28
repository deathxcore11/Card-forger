// Pictures of the baked voxel models for the cards of an offer (an item's own model, a summon's body). View only.
// A model is fetched when first asked for, drawn once with the game's renderer into a small target from a three-quarter view, and kept as a data URL.
import { BLOCKS, loadMapModels, blockMerged, blockMats } from './models.js';
const T = window.THREE, SIZE = 192, cache = new Map(), waiting = new Map();
let R = null, rt = null, S = null, cam = null, buf = null, cv = null;
export function initThumbs(renderer) { R = renderer; }
function draw(id) {
  const model = BLOCKS[id]; if (!model || !R) return null;
  if (!rt) { rt = new T.WebGLRenderTarget(SIZE, SIZE); S = new T.Scene(); S.add(new T.HemisphereLight(0xfff3d6, 0x5a4a78, 0.72)); const sun = new T.DirectionalLight(0xffe2b0, 0.5); sun.position.set(2.5, 4, 3); S.add(sun); cam = new T.PerspectiveCamera(30, 1, 0.01, 500); buf = new Uint8Array(SIZE * SIZE * 4); cv = document.createElement('canvas'); cv.width = cv.height = SIZE; }
  const geo = blockMerged(model, 0), M = blockMats(), mesh = new T.Mesh(geo, M.solid); geo.computeBoundingBox(); const bb = geo.boundingBox, c = bb.getCenter(new T.Vector3()), sz = bb.getSize(new T.Vector3()), r = Math.max(sz.x, sz.y, sz.z) * 0.5 || 1;
  S.add(mesh); const d = r / Math.tan(15 * Math.PI / 180) * 1.02; cam.position.set(c.x + d * 0.55, c.y + d * 0.38, c.z + d * 0.74); cam.lookAt(c); cam.updateProjectionMatrix();
  const prevT = R.getRenderTarget(), prevC = R.getClearColor(new T.Color()), prevA = R.getClearAlpha();
  try { R.setRenderTarget(rt); R.setClearColor(0x000000, 0); R.clear(); R.render(S, cam); R.readRenderTargetPixels(rt, 0, 0, SIZE, SIZE, buf); }
  finally { R.setRenderTarget(prevT); R.setClearColor(prevC, prevA); S.remove(mesh); geo.dispose(); }
  const ctx = cv.getContext('2d'), img = ctx.createImageData(SIZE, SIZE);
  for (let y = 0; y < SIZE; y++) img.data.set(buf.subarray((SIZE - 1 - y) * SIZE * 4, (SIZE - y) * SIZE * 4), y * SIZE * 4);       // the target reads bottom row first
  ctx.putImageData(img, 0, 0); return cv.toDataURL('image/png');
}
// the picture of model `id` into <img> `el` (now if it is ready, else when it has loaded); the img stays hidden if there is no such model
export function thumbInto(el, id) {
  if (!R || !id) return; const have = cache.get(id); if (have) { el.src = have; el.hidden = false; return; }
  if (cache.has(id)) return;       // known missing
  let L = waiting.get(id); if (L) { L.push(el); return; } L = [el]; waiting.set(id, L);
  loadMapModels([id]).then(() => { let url = null; try { url = draw(id); } catch (e) { console.warn('thumb', id, e.message); } cache.set(id, url); waiting.delete(id); if (url) for (const q of L) { q.src = url; q.hidden = false; } });
}
// the bodies of the six hand-made summons (the same table the field uses)
export const HAND_BODY = { 'ember-wyvern': ['wyv1', 'wyv2', 'wyv3'], 'cinder-hatchling': ['hat1', 'hat2', 'hat3'], 'sigil-familiar': ['familiar'], 'twinflare-tyrant': ['tyrant'], 'rune-apprentice': ['newt'], 'astral-magus': ['strix'] };
