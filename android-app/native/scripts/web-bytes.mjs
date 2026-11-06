// The byte classes rule-corpus.js loadRulePack uses that this QuickJS lacks: TextEncoder / TextDecoder (UTF-8) and
// crypto.subtle.digest('SHA-256'), as the WHATWG and Web Crypto specs define them for those calls.
if (typeof globalThis.TextEncoder === 'undefined') globalThis.TextEncoder = class TextEncoder { get encoding() { return 'utf-8'; } encode(t = '') { return globalThis.__utf8Bytes(t); } };
if (typeof globalThis.TextDecoder === 'undefined') globalThis.TextDecoder = class TextDecoder {
  get encoding() { return 'utf-8'; }
  decode(b) {
    if (!b) return ''; const u = b instanceof Uint8Array ? b : ArrayBuffer.isView(b) ? new Uint8Array(b.buffer, b.byteOffset, b.byteLength) : new Uint8Array(b);
    let out = '', chunk = []; let i = u[0] === 0xef && u[1] === 0xbb && u[2] === 0xbf ? 3 : 0;
    const flush = () => { out += String.fromCharCode.apply(null, chunk); chunk = []; };
    while (i < u.length) {
      const a = u[i]; let c, n;
      if (a < 0x80) { c = a; n = 1; } else if (a >= 0xc2 && a < 0xe0) { c = (a & 31) << 6 | u[i + 1] & 63; n = 2; }
      else if (a >= 0xe0 && a < 0xf0) { c = (a & 15) << 12 | (u[i + 1] & 63) << 6 | u[i + 2] & 63; n = 3; }
      else if (a >= 0xf0 && a < 0xf5) { c = (a & 7) << 18 | (u[i + 1] & 63) << 12 | (u[i + 2] & 63) << 6 | u[i + 3] & 63; n = 4; }
      else { c = 0xfffd; n = 1; }
      if (c > 0xffff) { c -= 0x10000; chunk.push(0xd800 + (c >> 10), 0xdc00 + (c & 1023)); } else chunk.push(c);
      i += n; if (chunk.length > 8000) flush();
    }
    flush(); return out;
  }
};
const K = [0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
  0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
  0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
  0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2];
export function sha256(bytes) {
  const len = bytes.length, total = ((len + 9 + 63) >> 6) << 6, m = new Uint8Array(total); m.set(bytes); m[len] = 0x80;
  const bits = len * 8; m[total - 4] = bits >>> 24; m[total - 3] = bits >>> 16 & 255; m[total - 2] = bits >>> 8 & 255; m[total - 1] = bits & 255;
  m[total - 5] = Math.floor(len / 0x20000000) & 255;
  const H = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19], W = new Int32Array(64);
  for (let o = 0; o < total; o += 64) {
    for (let t = 0; t < 16; t++) W[t] = m[o + 4 * t] << 24 | m[o + 4 * t + 1] << 16 | m[o + 4 * t + 2] << 8 | m[o + 4 * t + 3];
    for (let t = 16; t < 64; t++) { const x = W[t - 15], y = W[t - 2];
      W[t] = (((x >>> 7 | x << 25) ^ (x >>> 18 | x << 14) ^ x >>> 3) + W[t - 7] + ((y >>> 17 | y << 15) ^ (y >>> 19 | y << 13) ^ y >>> 10) + W[t - 16]) | 0; }
    let [a, b, c, d, e, f, g, h] = H;
    for (let t = 0; t < 64; t++) {
      const t1 = (h + ((e >>> 6 | e << 26) ^ (e >>> 11 | e << 21) ^ (e >>> 25 | e << 7)) + (e & f ^ ~e & g) + K[t] + W[t]) | 0;
      const t2 = (((a >>> 2 | a << 30) ^ (a >>> 13 | a << 19) ^ (a >>> 22 | a << 10)) + (a & b ^ a & c ^ b & c)) | 0;
      h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
    }
    H[0] = H[0] + a | 0; H[1] = H[1] + b | 0; H[2] = H[2] + c | 0; H[3] = H[3] + d | 0; H[4] = H[4] + e | 0; H[5] = H[5] + f | 0; H[6] = H[6] + g | 0; H[7] = H[7] + h | 0;
  }
  const out = new Uint8Array(32); H.forEach((v, i) => { out[4 * i] = v >>> 24; out[4 * i + 1] = v >>> 16 & 255; out[4 * i + 2] = v >>> 8 & 255; out[4 * i + 3] = v & 255; });
  return out;
}
const cr = globalThis.crypto || (globalThis.crypto = {});
if (!cr.subtle) cr.subtle = {digest: (alg, data) => Promise.resolve().then(() => {
  const name = typeof alg === 'string' ? alg : alg?.name; if (String(name).toUpperCase() !== 'SHA-256') throw Error('Unsupported digest ' + name);
  const u = data instanceof Uint8Array ? data : ArrayBuffer.isView(data) ? new Uint8Array(data.buffer, data.byteOffset, data.byteLength) : new Uint8Array(data);
  return sha256(u).buffer;
})};
// btoa (HTML's forgiving base64 of a byte string), as share.js toB64url uses it to write a share link.
if (typeof globalThis.btoa === 'undefined') {
  const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  globalThis.btoa = (s) => {
    s = String(s); let out = '';
    for (let i = 0; i < s.length; i += 3) {
      const n = s.length - i, a = s.charCodeAt(i), b = n > 1 ? s.charCodeAt(i + 1) : 0, c = n > 2 ? s.charCodeAt(i + 2) : 0;
      if (a > 255 || b > 255 || c > 255) throw Error('The string to be encoded contains characters outside of the Latin1 range.');
      const v = a << 16 | b << 8 | c;
      out += B64[v >> 18 & 63] + B64[v >> 12 & 63] + (n > 1 ? B64[v >> 6 & 63] : '=') + (n > 2 ? B64[v & 63] : '=');
    }
    return out;
  };
}
