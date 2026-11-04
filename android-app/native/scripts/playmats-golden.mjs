// Golden values from the web's own playmat code, for PlaymatsTest (node scripts/playmats-golden.mjs <repo> <out>):
// nextPlaymat/readPlaymatChoice runs with fixed random numbers, the scene tables in play-playmats.js (HEDRONS, HALOS,
// SPARKLES, CLOUDS) and each mat's light, motes and rise plus the light keyframes from play-forge-table.css.
import {readFileSync, writeFileSync, mkdtempSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
const [root, out] = process.argv.slice(2);
const src = readFileSync(join(root, 'play-playmats.js'), 'utf8');
const tmp = join(mkdtempSync(join(tmpdir(), 'mats-')), 'play-playmats.mjs');
writeFileSync(tmp, src + '\nexport {HEDRONS,HALOS,SPARKLES,CLOUDS};\n');
const mats = await import(pathToFileURL(tmp).href);
const store = init => { const m = new Map(Object.entries(init)); return {getItem: k => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), dump: () => Object.fromEntries(m)}; };
const randoms = [0, .07, .5, .93, .999999, .3, .3, .61];
const runs = [{}, {'cardstashy.playmat': 'rotate'}, {'cardstashy.playmat': 'ashen-forge'}, {'cardstashy.playmat': 'nope'}, {'cardstashy.playmat.last': 'moonlit-courtyard'}, {'cardstashy.playmat.last': 'charcoal-table'}]
  .map(init => { const s = store(init), picks = randoms.map(r => mats.nextPlaymat(s, () => r)); return {init, choice: mats.readPlaymatChoice(store(init)), picks, after: s.dump()}; });
const css = readFileSync(join(root, 'play-forge-table.css'), 'utf8');
const looks = Object.fromEntries(mats.PLAYMATS.map(([id]) => {
  const body = css.match(new RegExp(`\\.playmat-scene\\[data-playmat=${id}\\]\\{([^}]*)\\}`))[1];
  const v = k => body.match(new RegExp(`${k}:([^;]+)`))?.[1];
  return [id, {light: v('--mat-light'), lightS: parseFloat(v('--mat-light-s')), motes: v('--mat-motes') === 'none' ? null : v('--mat-motes').match(/playmat-fx-([a-z]+)\.webp/)[1], rise: parseFloat(v('--mat-rise') ?? '30s')}];
}));
const lights = {};
for (const m of css.matchAll(/@keyframes (mat-(?:candle|candle-soft|lava|shimmer|firefly|water))\{(.*?\})\}/g)) {
  const stops = [];
  for (const k of m[2].matchAll(/([\d%,]+)\{([^}]*)\}/g)) { const o = +k[2].match(/opacity:([\d.]+)/)[1]; for (const p of k[1].split(',')) stops.push([parseFloat(p) / 100, o]); }
  lights[m[1]] = stops.sort((a, b) => a[0] - b[0]);
}
writeFileSync(out, JSON.stringify({playmats: mats.PLAYMATS, randoms, runs, hedrons: mats.HEDRONS, halos: mats.HALOS, sparkles: mats.SPARKLES, clouds: mats.CLOUDS, looks, lights}, null, 1));
console.log(`playmats golden: ${runs.length} runs, ${Object.keys(looks).length} looks, ${Object.keys(lights).length} lights`);
