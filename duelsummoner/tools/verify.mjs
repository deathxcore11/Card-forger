// Verifies a replay record from a run report: rebuilds the run from its seed, difficulty and mode, feeds every recorded input tick by
// tick, and checks that the score, the final state hash and the tick count match. A tampered score, tape or setup fails.
//   node tools/verify.mjs record.json        exit code 0 = verified, 1 = mismatch
import { readFileSync } from 'node:fs';
import { inflateSync, deflateSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { Game } from '../src/sim/game.js';
import { hashHex } from '../src/sim/hash.js';
import { decodeRuns, fromBase64 } from '../src/core/replay.js';
import { BUILD_VERSION } from '../src/sim/results.js';

export const nodeDeflate = bytes => new Uint8Array(deflateSync(Buffer.from(bytes)));

export function verifyReplay(rec) {
  const why = [];
  if (!rec || rec.v !== 1 || !rec.tape) return { ok: false, why: ['not a replay record'] };
  let bytes = fromBase64(rec.tape.data);
  if (rec.tape.format === 'rle-varint-deflate-b64') bytes = new Uint8Array(inflateSync(Buffer.from(bytes)));
  const runs = decodeRuns(bytes);
  const opts = { duelist: rec.duelist, mode: rec.mode, difficulty: rec.difficulty, offers: rec.offers, oaths: rec.oaths || [] };
  if (rec.world !== null && rec.world !== undefined) opts.world = rec.world; if (rec.meta) opts.meta = rec.meta;
  const g = new Game(rec.seed, opts), r = { mx: 0, mz: 0, yaw: 0, buttons: 0, menu: 0 };
  let calls = 0;
  for (let i = 0; i < runs.length; i += 6) { r.mx = runs[i + 1]; r.mz = runs[i + 2]; r.yaw = runs[i + 3]; r.buttons = runs[i + 4]; r.menu = runs[i + 5]; for (let k = 0; k < runs[i]; k++) { if (rec.endAt === calls) g.endRun(); g.tick(r); calls++; } }
  if (rec.ended && !g.over) g.endRun();
  const hash = hashHex(g), score = g.score();
  if (calls !== rec.ticks) why.push('tick count ' + calls + ' does not match ' + rec.ticks);
  if (score !== rec.score) why.push('score ' + score + ' does not match the claimed ' + rec.score);
  if (hash !== rec.hash) why.push('state hash ' + hash + ' does not match the claimed ' + rec.hash);
  if (rec.version !== BUILD_VERSION) why.push('note: recorded on build ' + rec.version + ', verified on ' + BUILD_VERSION);
  return { ok: why.filter(w => !w.startsWith('note')).length === 0, why, score, hash, ticks: calls };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const f = process.argv[2]; if (!f) { console.log('usage: node tools/verify.mjs record.json'); process.exit(2); }
  const res = verifyReplay(JSON.parse(readFileSync(f, 'utf8')));
  console.log(res.ok ? 'VERIFIED score ' + res.score + ' hash ' + res.hash + ' (' + res.ticks + ' ticks)' : 'REJECTED: ' + res.why.join('; '));
  process.exit(res.ok ? 0 : 1);
}

