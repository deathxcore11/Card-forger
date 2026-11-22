// Replay records for verified leaderboards. The sim keeps every tick() input as run-length records [count, mx, mz, yaw, buttons, menu]
// (Game.replayRaw). Here they are packed into bytes: each run is delta-coded against the one before and written as varints, and the
// caller may deflate the result (a zlib stream; Node has zlib, browsers have CompressionStream). Pure: no platform access.
const zig = n => (n << 1) ^ (n >> 31), unzig = u => (u >>> 1) ^ -(u & 1);

export function encodeRuns(runs) {
  const out = []; let pm = 0, pz = 0, py = 0;
  const put = v => { v >>>= 0; while (v >= 128) { out.push((v & 127) | 128); v >>>= 7; } out.push(v); };
  for (let i = 0; i < runs.length; i += 6) {
    put(runs[i]); put(zig(runs[i + 1] - pm)); put(zig(runs[i + 2] - pz)); put(zig(runs[i + 3] - py)); put(runs[i + 4]); put(runs[i + 5]);
    pm = runs[i + 1]; pz = runs[i + 2]; py = runs[i + 3];
  }
  return Uint8Array.from(out);
}
export function decodeRuns(bytes) {
  const out = []; let p = 0, pm = 0, pz = 0, py = 0;
  const get = () => { let v = 0, s = 0, b; do { b = bytes[p++]; v |= (b & 127) << s; s += 7; } while (b & 128); return v >>> 0; };
  while (p < bytes.length) {
    const c = get(); pm += unzig(get()); pz += unzig(get()); py += unzig(get()); const bt = get(), mn = get();
    out.push(c, pm, pz, py, bt, mn);
  }
  return Int32Array.from(out);
}
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
export function toBase64(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i], b = bytes[i + 1], c = bytes[i + 2], n = (a << 16) | ((b || 0) << 8) | (c || 0);
    s += B64[(n >> 18) & 63] + B64[(n >> 12) & 63] + (i + 1 < bytes.length ? B64[(n >> 6) & 63] : '=') + (i + 2 < bytes.length ? B64[n & 63] : '=');
  }
  return s;
}
export function fromBase64(s) {
  const out = []; let buf = 0, bits = 0;
  for (let i = 0; i < s.length; i++) { const k = B64.indexOf(s[i]); if (k < 0) continue; buf = (buf << 6) | k; bits += 6; if (bits >= 8) { bits -= 8; out.push((buf >> bits) & 255); } }
  return Uint8Array.from(out);
}

// raw: Game.replayRaw(). deflate: optional (Uint8Array) => Uint8Array (sync) or Promise of it.
export function packReplay(raw, deflate) {
  const bytes = encodeRuns(raw.runs), done = d => ({ v: raw.v, version: raw.version, seed: raw.seed, duelist: raw.duelist, mode: raw.mode, difficulty: raw.difficulty, oaths: raw.oaths, world: raw.world, offers: raw.offers, meta: raw.meta,
    ticks: raw.ticks, ended: raw.ended, endAt: raw.endAt, hash: raw.hash, score: raw.score, tape: { format: deflate ? 'rle-varint-deflate-b64' : 'rle-varint-b64', runs: raw.runs.length / 6, data: toBase64(d) } });
  const z = deflate ? deflate(bytes) : bytes;
  return z && typeof z.then === 'function' ? z.then(done) : done(z);
}
export async function deflateInBrowser(bytes) {
  const cs = new CompressionStream('deflate'), w = cs.writable.getWriter(); w.write(bytes); w.close();
  return new Uint8Array(await new Response(cs.readable).arrayBuffer());
}

