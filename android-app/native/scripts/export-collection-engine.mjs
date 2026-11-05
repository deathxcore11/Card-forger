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
