#!/usr/bin/env node
// CLI: node gen.mjs --seed N --stage S --out dir [--seal CODE] [--all-stages] [--scale 2] [--debug] [--no-fields]
// Writes <seal>_s<stage>.json (canonical, byte-identical per seed), <seal>_s<stage>.timing.json and .png.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { generateStage } from './generate.mjs';
import { encodeSeal, decodeSeal } from './seed.mjs';
import { mapHash, stageJSON } from './emit.mjs';
import { renderPNG } from './render.mjs';

const USAGE = 'usage: node gen.mjs --seed N | --seal CODE  [--stage 1|2|3 | --all-stages] [--out dir] [--scale 1-8] [--debug] [--no-fields] [--no-png]\n' +
  '  --seed  a whole number 0..1099511627775 (40 bits)\n  --seal  8 Crockford base32 characters (0-9, A-Z without I L O U; I/L read as 1, O as 0)';
export function parseArgs(argv) {
  const o = { stages: [1], out: 'out', scale: 2, debug: false, fields: true, png: true, errors: [] };
  const need = (k, v) => { if (v === undefined || v.startsWith('--')) { o.errors.push(`${k} needs a value`); return false; } return true; };
  for (let k = 0; k < argv.length; k++) {
    const a = argv[k], v = argv[k + 1];
    if (a === '--seed') { if (!need(a, v)) continue; k++;
      if (!/^[0-9]{1,13}$/.test(v) || Number(v) > 0xFFFFFFFFFF) o.errors.push(`--seed must be a whole number from 0 to 1099511627775, got "${v}"`);
      else { const n = Number(v); o.seal = encodeSeal(Math.floor(n / 0x100000000), n % 0x100000000); } }
    else if (a === '--seal') { if (!need(a, v)) continue; k++;
      try { decodeSeal(v); o.seal = String(v).toUpperCase().replace(/[IL]/g, '1').replace(/O/g, '0'); } catch (e) { o.errors.push(`--seal "${v}": ${e.message}`); } }
    else if (a === '--stage') { if (!need(a, v)) continue; k++; if (!/^[123]$/.test(v)) o.errors.push(`--stage must be 1, 2 or 3, got "${v}"`); else o.stages = [Number(v)]; }
    else if (a === '--all-stages') o.stages = [1, 2, 3];
    else if (a === '--out') { if (!need(a, v)) continue; o.out = v; k++; }
    else if (a === '--scale') { if (!need(a, v)) continue; k++; if (!/^[1-8]$/.test(v)) o.errors.push(`--scale must be 1-8, got "${v}"`); else o.scale = Number(v); }
    else if (a === '--debug') o.debug = true;
    else if (a === '--no-fields') o.fields = false;
    else if (a === '--no-png') o.png = false;
    else if (a === '--help' || a === '-h') o.help = true;
    else o.errors.push(`unknown argument "${a}"`);
  }
  return o;
}

export function runOne(seal, stage, o) {
  const res = generateStage(seal, stage);
  if (!res.m || !res.V) return { res, files: [] };
  res.hash = mapHash(res);
  const base = join(o.out, `${res.sealCode}_s${stage}`);
  const files = [];
  writeFileSync(base + '.json', JSON.stringify(stageJSON(res, { fields: o.fields }))); files.push(base + '.json');
  writeFileSync(base + '.timing.json', JSON.stringify({ sealCode: res.sealCode, stage, ms: res.timing })); files.push(base + '.timing.json');
  if (o.png) { writeFileSync(base + '.png', renderPNG(res, { scale: o.scale, debug: o.debug })); files.push(base + '.png'); }
  return { res, files };
}

const isMain = process.argv[1] && import.meta.url === new URL('file://' + process.argv[1]).href;
if (isMain) {
  const o = parseArgs(process.argv.slice(2));
  if (o.help) { console.log(USAGE); process.exit(0); }
  if (o.errors.length || !o.seal) { for (const e of o.errors) console.error('error: ' + e); if (!o.seal && !o.errors.length) console.error('error: give --seed or --seal'); console.error(USAGE); process.exit(1); }
  mkdirSync(o.out, { recursive: true });
  let bad = 0;
  for (const stage of o.stages) {
    const { res, files } = runOne(o.seal, stage, o);
    const V = res.V; const failing = V ? V.failing : ['no_map'];
    if (!res.ok) bad++;
    console.log(`${res.sealCode} stage ${stage}: ${res.ok ? 'OK' : 'FAIL'} attempt ${res.attempt}${res.fallback ? ' (fallback)' : ''} hash ${res.hash || '-'} ${res.timing.total} ms` +
      (failing.length ? ` failing ${failing.join(',')}` : '') + (files.length ? `\n  ${files.join('\n  ')}` : ''));
  }
  process.exit(bad ? 2 : 0);
}
