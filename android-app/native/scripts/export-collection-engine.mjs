// Bundles the site's Collection Home code into assets/collection-engine.js for QuickJS (CollectionEngine.kt).
// node scripts/export-collection-engine.mjs <web root> [esbuild binary]  (default: scripts/js-tools, npm ci there first)
import {join, dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {readFileSync, writeFileSync, mkdirSync} from 'node:fs';
import {bundleWeb, ESBUILD, WEB_PLATFORM} from './bundle-web.mjs';
const [web, esbuild = ESBUILD] = process.argv.slice(2);
const app = resolve(dirname(fileURLToPath(import.meta.url)), '..');
// tcg.js's Card of the Day (heroFor, loadHero, homeHero, homeToday), cut out of the live file at export time so it is always the
// site's current code: importing tcg.js itself would pull in the whole site (1 MB) for six functions.
const tcg = readFileSync(join(web, 'tcg.js'), 'utf8'), from = tcg.indexOf('const HERO_KEY = "cardforge-hero-v2";'), to = tcg.indexOf('/* ---------- home ---------- */');
if (from < 0 || to < from) throw Error('tcg.js Card of the Day block moved: update export-collection-engine.mjs');
const W = f => JSON.stringify(join(resolve(web), f));
mkdirSync(join(app, 'build'), {recursive: true});
writeFileSync(join(app, 'build', 'tcg-daily-hero.mjs'), `// Cut from tcg.js by scripts/export-collection-engine.mjs; do not edit.
import {dailyDate, nextDailyReset} from ${W('daily-clock.js')};
import {GAMES, GAME_IDS} from ${W('games.js')};
import {esc} from ${W('ui.js')};
import {homeSearchMarkup} from ${W('home-search.js')};
import {pokemonArtCrop} from ${W('artwork.js')};
${tcg.slice(from, to)}
`);
const {sha, kb} = bundleWeb({web, esbuild, preludes: WEB_PLATFORM, entry: 'collection-engine-entry.mjs', name: 'collection-engine', banner: 'CardStashy Collection engine bundle',
  out: join(app, 'app/src/main/assets/collection-engine.js')});
console.log('collection engine bundled from', sha, kb + ' KB');

// The Scanner's engine for the app's WebView (ScanWeb.kt): scancam.js and its scan-* modules as the site runs them, with Chrome's own
// canvas, images, timers, fetch and storage (scan-web-entry.mjs). The site's text reader goes with it (vendor/tesseract.min.js and
// vendor/worker.min.js, served to that page as the site serves them; its core and language data load from jsdelivr, as on the site).
{
  const {execFileSync} = await import('node:child_process');
  const tmp = join(app, 'build', 'scan-web-entry.mjs');
  writeFileSync(tmp, readFileSync(join(app, 'scripts', 'scan-web-entry.mjs'), 'utf8').replaceAll("'WEB/", `'${resolve(web)}/`).replaceAll("'./site-json.mjs'", `'${join(app, 'scripts', 'site-json.mjs')}'`));
  const out = join(app, 'app/src/main/assets/scan-web.js');
  execFileSync(esbuild, [tmp, '--bundle', '--format=iife', '--platform=browser', '--target=es2020', '--define:import.meta.url="https://cardstashy.com/"',
    `--banner:js=/* CardStashy Scanner engine (WebView), web ${sha} */`, `--outfile=${out}`, '--log-level=error']);
  mkdirSync(join(app, 'app/src/main/assets/vendor'), {recursive: true});
  for (const f of ['tesseract.min.js', 'worker.min.js', 'TESSERACT-LICENSE.txt']) writeFileSync(join(app, 'app/src/main/assets/vendor', f), readFileSync(join(web, 'vendor', f)));
  console.log('scanner engine (WebView) bundled', (readFileSync(out).length / 1024).toFixed(0) + ' KB');
}
