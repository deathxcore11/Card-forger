// Bundles the web's Deck Forge into assets/deck-engine.js (QuickJS, no DOM, no fetch) and writes the
// parity fixtures: the same bundle run in Node over a fixture Trunk, which EngineTest must match in QuickJS.
// node scripts/export-deck-engine.mjs <web root> <esbuild binary> <fixture trunk cards.json>
import {execFileSync} from 'node:child_process';
import {readFileSync, writeFileSync} from 'node:fs';
import {join, dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';
const [web, esbuild, trunkFile] = process.argv.slice(2);
const here = dirname(fileURLToPath(import.meta.url)), app = resolve(here, '..');
const entry = join(app, 'build', 'deck-engine-entry.mjs');
writeFileSync(entry, readFileSync(join(here, 'deck-engine-entry.mjs'), 'utf8').replaceAll("'WEB/", `'${resolve(web)}/`));
const sha = process.env.WEB_SHA || (() => { try { return execFileSync('git', ['-C', web, 'rev-parse', 'HEAD']).toString().trim(); } catch { return 'unknown'; } })();
execFileSync(esbuild, [entry, '--bundle', '--format=iife', '--platform=neutral', '--target=es2020', `--inject:${join(here, 'deck-engine-prelude.js')}`,
  '--define:import.meta.url="https://cardstashy.com/"', `--banner:js=/* CardStashy Deck Forge bundle, web ${sha} */`, `--outfile=${join(app, 'app/src/main/assets/deck-engine.js')}`, '--log-level=error']);
// Fixtures: the bundle in a bare context (no browser globals), as QuickJS sees it.
const ctx = vm.createContext({}); vm.runInContext(readFileSync(join(app, 'app/src/main/assets/deck-engine.js'), 'utf8'), ctx);
const cards = JSON.parse(readFileSync(trunkFile, 'utf8'));
const facts = {}, ownedCards = [];
cards.forEach((c, i) => { const o = c.oracle_id || c.card_faces?.[0]?.oracle_id; facts[o] = c; ownedCards.push({o, c: 1 + (i % 4)}); });
const out = ['Standard', 'Pioneer', 'Modern', 'Legacy', 'Vintage', 'Pauper', 'Commander', 'Standard Brawl'].map(format => {
  const input = JSON.stringify({format, ownedCards, facts});
  return {format, input, out: ctx.CardStashyEngine.forgeTrunk(input)};
});
writeFileSync(join(app, 'app/src/test/resources/engine-golden.json'), JSON.stringify(out));
console.log('deck engine bundled from', sha, out.map(x => x.format + ':' + (JSON.parse(x.out)?.open ?? 'none')).join(' '));
