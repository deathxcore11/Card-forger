// The phone's fingerprint must equal the index builder's (scripts/build-scan-index.py), bit for bit.
import assert from "node:assert/strict";
const { scanHash, nearest, REC, HW, HH } = await import("./scanart.js");
const d = new Uint8Array(HW * HH * 4);
for (let y = 0; y < HH; y++) for (let x = 0; x < HW; x++) { const i = (y * HW + x) * 4; d[i] = (x * 7 + y * 3) % 256; d[i + 1] = (x * y) % 251; d[i + 2] = (x ^ y) % 256; d[i + 3] = 255; }
const hex = (u) => Buffer.from(u).toString("hex");
assert.equal(hex(scanHash(d, "mtg")), "484aa05db66ff498006e6fbe13ee01d47f7d6f");
assert.equal(hex(scanHash(d, "ptcg")), "482a915db67fb450006e6fbe13ee01d47f7d6a");
assert.equal(hex(scanHash(d, "ygo")), "7a4bbf94401bb544006e6fbe13ee01d4807d7b");
// Nearest: the exact record wins; one flipped art bit is next.
const h = scanHash(d, "mtg"), bin = new Uint8Array(REC * 3);
const far = h.map((v, i) => (i < 16 ? v ^ 0xff : v)), near = h.slice(); near[0] ^= 1;
bin.set(far, 0); bin.set(near, REC); bin.set(h, REC * 2);
assert.deepEqual(nearest(h, bin, 2).map(([i]) => i), [2, 1]);
console.log("PASS: scan fingerprints match the index builder; nearest search ranks correctly.");
