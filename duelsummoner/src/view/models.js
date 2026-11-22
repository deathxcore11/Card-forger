// Loader for the owner's baked low-poly models (EWV1 / EWV2: flat colour per face, no texture). Everything is optional:
// if a file is missing the game keeps its placeholder shape. Files live in assets/models/ and are kept out of the public repo.
const T = window.THREE;

function b64ToBytes(text) {
  const s = atob(text.replace(/\s+/g, '')), a = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) a[i] = s.charCodeAt(i);
  return a;
}

// Returns { solid: BufferGeometry (vertex-coloured), glow: BufferGeometry|null, size:{x,y,z}, min, max, nostrils:[[x,y,z],...] } in model units.
export function decodeEwv(bytes) {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const magic = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]);
  if (magic !== 'EWV1' && magic !== 'EWV2') throw new Error('bad model magic ' + magic);
  const vc = dv.getUint16(4, true), tc = dv.getUint16(6, true);
  const min = [dv.getFloat32(8, true), dv.getFloat32(12, true), dv.getFloat32(16, true)];
  const max = [dv.getFloat32(20, true), dv.getFloat32(24, true), dv.getFloat32(28, true)];
  let off = 32;
  const pos = new Float32Array(vc * 3);
  for (let i = 0; i < vc * 3; i++, off += 2) { const a = i % 3; pos[i] = min[a] + dv.getUint16(off, true) / 65535 * (max[a] - min[a]); }
  const idx = new Uint16Array(tc * 3);
  for (let i = 0; i < tc * 3; i++, off += 2) idx[i] = dv.getUint16(off, true);
  const col = new Uint16Array(tc);
  for (let i = 0; i < tc; i++, off += 2) col[i] = dv.getUint16(off, true);
  let glowBits = null, nostrils = [];
  if (magic === 'EWV2') {
    const gb = Math.ceil(tc / 8); glowBits = bytes.subarray(off, off + gb); off += gb;
    for (let k = 0; k < 2; k++, off += 12) nostrils.push([dv.getFloat32(off, true), dv.getFloat32(off + 4, true), dv.getFloat32(off + 8, true)]);
  }
  const build = wantGlow => {
    const p = [], c = [];
    for (let f = 0; f < tc; f++) {
      const isGlow = glowBits ? ((glowBits[f >> 3] >> (f & 7)) & 1) === 1 : false;
      if (isGlow !== wantGlow) continue;
      const v = col[f], r = (v & 31) / 31, g = ((v >> 5) & 31) / 31, b = ((v >> 10) & 31) / 31;
      for (let k = 0; k < 3; k++) { const vi = idx[f * 3 + k] * 3; p.push(pos[vi], pos[vi + 1], pos[vi + 2]); c.push(r, g, b); }
    }
    if (!p.length) return null;
    const geo = new T.BufferGeometry();
    geo.setAttribute('position', new T.Float32BufferAttribute(p, 3)); geo.setAttribute('color', new T.Float32BufferAttribute(c, 3));
    geo.computeVertexNormals();                                   // non-indexed, so each face keeps its own flat normal
    return geo;
  };
  return { solid: build(false), glow: glowBits ? build(true) : null, min, max, size: { x: max[0] - min[0], y: max[1] - min[1], z: max[2] - min[2] }, nostrils };
}

export async function loadModel(url) {
  try {
    const r = await fetch(url, { cache: 'no-store' });
    if (!r.ok) return null;
    return decodeEwv(b64ToBytes(await r.text()));
  } catch (e) { return null; }
}

export async function loadPuffTexture(url) {
  const make = img => { const t = new T.Texture(img); t.magFilter = T.NearestFilter; t.minFilter = T.NearestFilter; t.generateMipmaps = false; t.needsUpdate = true; return t; };
  try {
    const r = await fetch(url, { cache: 'no-store' });
    if (r.ok) {
      const img = new Image(); img.src = 'data:image/png;base64,' + (await r.text()).replace(/\s+/g, '');
      await new Promise((res, rej) => { img.onload = res; img.onerror = rej; });
      return make(img);
    }
  } catch (e) { /* fall through to a drawn puff */ }
  const c = document.createElement('canvas'); c.width = c.height = 16; const x = c.getContext('2d');
  x.fillStyle = '#fff'; for (const [cx, cy, rr] of [[8, 8, 6], [5, 9, 4], [11, 9, 4], [8, 5, 4]]) { x.beginPath(); x.arc(cx, cy, rr, 0, 7); x.fill(); }
  return make(c);
}
