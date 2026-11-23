// Element silhouettes for the six unwired elements (step 14, "shape before colour"). Lab-only until the sim wires them: each element is built from flat, unlit pieces in its own ramp tones, and is told apart from the others by SHAPE and MOTION,
// so a black and white screenshot still names it:
//   ice      shards and a frost sheet: sharp 4-sided spikes of three heights standing on a flat hexagon that lies on the ground; nearly still, a slow sparkle
//   poison   a low pooling cloud: flattened round lumps hugging the ground, swelling and sinking, with small bubbles rising and popping; nothing tall, nothing sharp
//   wind     tilted spiral ribbons: thin flat strips winding up a leaning axis, turning and travelling upward; the only element made of curved, thin, moving lines
//   earth    faceted slabs thrusting up: heavy tilted boxes shoved out of the ground in turn with a hard stop, over a ring of cracks; angular, blocky, no curves
//   light    vertical shafts: tall thin straight columns of different heights in a row on a card-shaped (5:7) ground rectangle; pulse in height, no sideways motion
//   dark     a hole with a pale edge: a black disc with a thin bright rim and small wisps that move INWARD and shrink; the only element that is a void, and the only one that moves toward its centre
const T = window.THREE;
import { RAMP } from '../data/fxramp.js';
import { ownColour } from './fxcolour.js';

const mat = hex => new T.MeshBasicMaterial({ color: hex, side: T.DoubleSide });
const hash = (i, k) => { const s = Math.sin(i * 127.1 + k * 311.7) * 43758.5453; return s - Math.floor(s); };

export function makeElementShape(name) {
  const R = RAMP[name], g = new T.Group(), parts = [];
  const body = ownColour(name), bright = R[1], core = R[0], shade = R[3];
  const add = (mesh, upd) => { g.add(mesh); parts.push(upd || null); return mesh; };
  if (name === 'ice') {
    const sheet = new T.Mesh(new T.CylinderGeometry(3.2, 3.2, 0.06, 6), mat(bright)); sheet.position.y = 0.05; add(sheet);
    const edge = new T.Mesh(new T.CylinderGeometry(3.3, 3.3, 0.04, 6), mat(shade)); edge.position.y = 0.02; add(edge);
    for (let i = 0; i < 9; i++) { const h = 1.2 + (i % 3) * 1.1 + hash(i, 1) * 0.6, r = 0.28 + hash(i, 2) * 0.16, a = i / 9 * 6.2832, d = 0.5 + hash(i, 3) * 2.0; const s = new T.Mesh(new T.ConeGeometry(r, h, 4), mat(i % 3 === 0 ? core : i % 3 === 1 ? bright : body)); s.position.set(Math.cos(a) * d, h / 2, Math.sin(a) * d); s.rotation.set((hash(i, 4) - 0.5) * 0.25, hash(i, 5) * 3, (hash(i, 6) - 0.5) * 0.25); add(s); }
  } else if (name === 'poison') {
    for (let i = 0; i < 7; i++) { const s = new T.Mesh(new T.IcosahedronGeometry(1, 0), mat(i % 2 ? bright : body)); const a = i / 7 * 6.2832, d = i === 0 ? 0 : 1.1 + hash(i, 1) * 1.1; s.position.set(Math.cos(a) * d, 0.25, Math.sin(a) * d); s.scale.set(1.0 + hash(i, 2) * 0.7, 0.28, 1.0 + hash(i, 3) * 0.7); add(s, t => { const k = 1 + 0.12 * Math.sin(t * 1.6 + i * 2); s.scale.y = 0.28 * k; s.scale.x = (1.0 + hash(i, 2) * 0.7) * (2 - k); }); }
    for (let i = 0; i < 7; i++) { const b = new T.Mesh(new T.IcosahedronGeometry(0.16, 0), mat(core)); add(b, t => { const u = (t * 0.45 + i * 0.37) % 1; b.position.set(Math.cos(i * 2.3) * 1.5, 0.3 + u * 1.5, Math.sin(i * 2.3) * 1.5); b.scale.setScalar(u > 0.9 ? 0.01 : 1 - u * 0.4); }); }
  } else if (name === 'wind') {
    for (let k = 0; k < 3; k++) {
      const N = 40, pos = [], idx = []; for (let i = 0; i <= N; i++) { const u = i / N, a = u * 9.4 + k * 2.1, rad = 0.5 + u * 1.5; for (const sd of [-1, 1]) pos.push(Math.cos(a) * rad, u * 6.5 + sd * 0.22, Math.sin(a) * rad); }
      for (let i = 0; i < N; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
      const geo = new T.BufferGeometry(); geo.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); geo.setIndex(idx); const m = new T.Mesh(geo, mat(k === 0 ? core : k === 1 ? bright : body)); m.rotation.z = 0.28; add(m, t => { m.rotation.y = t * 1.8 + k * 2.1; m.position.y = ((t * 0.9 + k * 0.33) % 1) * 0.8; });
    }
  } else if (name === 'earth') {
    const ring = new T.Mesh(new T.RingGeometry(3.0, 3.25, 10, 1), mat(shade)); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.05; add(ring);
    for (let i = 0; i < 6; i++) { const w = 0.9 + hash(i, 1) * 0.5, h = 2.4 + hash(i, 2) * 1.8, a = i / 6 * 6.2832, d = 0.4 + hash(i, 3) * 2.2; const s = new T.Mesh(new T.BoxGeometry(w, h, 0.55), mat(i % 2 ? body : bright)); s.rotation.set((hash(i, 4) - 0.5) * 0.6, a, (hash(i, 5) - 0.5) * 0.5); add(s, t => { const u = Math.min(1, ((t * 0.5 + i * 0.16) % 1.6) / 0.35); const e = 1 - Math.pow(1 - u, 3); s.position.set(Math.cos(a) * d, -h / 2 + (h * 0.62) * e, Math.sin(a) * d); }); }
  } else if (name === 'light') {
    const card = new T.Mesh(new T.BoxGeometry(5, 0.05, 7), mat(shade)); card.position.y = 0.03; add(card); const inner = new T.Mesh(new T.BoxGeometry(4.5, 0.06, 6.5), mat(core)); inner.position.y = 0.04; add(inner);
    for (let i = 0; i < 5; i++) { const s = new T.Mesh(new T.BoxGeometry(0.34, 1, 0.34), mat(i % 2 ? bright : body)); s.position.x = (i - 2) * 1.0; add(s, t => { const h = 7 + 5 * (0.5 + 0.5 * Math.sin(t * 1.4 + i * 1.3)); s.scale.y = h; s.position.y = h / 2; }); }
  } else if (name === 'dark') {
    const hole = new T.Mesh(new T.CircleGeometry(3, 28), mat(R[0])); hole.rotation.x = -Math.PI / 2; hole.position.y = 0.06; add(hole);
    const rim = new T.Mesh(new T.RingGeometry(2.9, 3.2, 28), mat(bright)); rim.rotation.x = -Math.PI / 2; rim.position.y = 0.07; add(rim);
    for (let i = 0; i < 12; i++) { const w = new T.Mesh(new T.ConeGeometry(0.14, 0.9, 3), mat(i % 3 ? R[2] : R[3])); add(w, t => { const u = (t * 0.5 + i * 0.083) % 1, a = i * 0.9 + u * 1.2, d = 6.5 * (1 - u); w.position.set(Math.cos(a) * d, 0.5 + u * 0.3, Math.sin(a) * d); w.lookAt(0, 0.5, 0); w.rotateX(Math.PI / 2); w.scale.setScalar(Math.max(0.05, 1 - u * 0.8)); }); }
  }
  return { group: g, update(t) { for (const u of parts) if (u) u(t); } };
}
