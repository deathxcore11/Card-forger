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
// ai-ask.js (Ask CardStashy: openAsk, ask, restartAsk, closeAsk and the words it writes), the site's file whole, with its own
// small page (site-dom.mjs) as its `document`: the app reads the chat back from that page (Collection.ask*, gap audit H3).
{
  const ask = readFileSync(join(web, 'ai-ask.js'), 'utf8').replace(/from '\.\/([\w.-]+)'/g, (_, f) => 'from ' + W(f)).replace(/from "\.\/([\w.-]+)"/g, (_, f) => 'from ' + W(f));
  if (!/export function openAsk/.test(ask) || !/export async function ask\(/.test(ask)) throw Error('ai-ask.js moved: update export-collection-engine.mjs');
  writeFileSync(join(app, 'build', 'ai-ask-cut.mjs'), `// ai-ask.js with its own page; written by scripts/export-collection-engine.mjs; do not edit.
import {Document as AskPage} from '../scripts/site-dom.mjs';
const document = new AskPage();
export const askPage = document;
${ask}
`);
}
// ai-rules.js (Ask a Judge: openRulesAsk, askRules, restartRulesAsk, removeRulesCardContext, closeRulesAsk and the words it writes),
// the site's file whole, with its own small page as its `document`: the app reads the chat back from that page (Collection.judge*, H4).
{
  const rules = readFileSync(join(web, 'ai-rules.js'), 'utf8').replace(/from '\.\/([\w.-]+)'/g, (_, f) => 'from ' + W(f)).replace(/from "\.\/([\w.-]+)"/g, (_, f) => 'from ' + W(f));
  if (!/export function openRulesAsk/.test(rules) || !/export async function askRules\(/.test(rules) || !/export async function validateRulesResponse/.test(rules)) throw Error('ai-rules.js moved: update export-collection-engine.mjs');
  writeFileSync(join(app, 'build', 'ai-rules-cut.mjs'), `// ai-rules.js with its own page; written by scripts/export-collection-engine.mjs; do not edit.
import {Document as RulesPage} from '../scripts/site-dom.mjs';
const document = new RulesPage();
export const rulesPage = document;
${rules}
// The open chat's own record (its context and entries: each answer as validateRulesResponse returned it), read by the app.
export const rulesSession = () => current;
`);
}
const {sha, kb} = bundleWeb({web, esbuild, preludes: WEB_PLATFORM, entry: 'collection-engine-entry.mjs', name: 'collection-engine', banner: 'CardStashy Collection engine bundle',
  out: join(app, 'app/src/main/assets/collection-engine.js')});
console.log('collection engine bundled from', sha, kb + ' KB');
// power.js memo keeps each deck's Power for the page's life; the app keeps it between visits too (globalThis.__powerKeep, filled
// and saved by the entry's powerLoad / powerSave): the Decks page then draws in a moment instead of re-running every deck's
// shuffles in QuickJS each time the app starts. The key is the site's own signature (the deck, its cards' rules evidence, the
// meta's date), so a changed deck or card is worked out again exactly as the site does.
{
  const f = join(app, 'app/src/main/assets/collection-engine.js'), js = readFileSync(f, 'utf8');
  const memo = `  var memo = (sig, fn) => {
    if (cache.has(sig)) return cache.get(sig);
    if (cache.size > 120) cache.clear();
    const v = fn();
    cache.set(sig, v);
    return v;
  };`;
  if (js.split(memo).length !== 2) throw Error('power.js memo changed: update the Power keep in export-collection-engine.mjs');
  // meta.js stamps fresh tournament data twice (M.at = Date.now(), then writeCache's own Date.now() a few ms later), so the next
  // visit reads a different date than this one used and every Commander deck's Power signature misses. The page keeps the saved stamp.
  const stamp = `        M2.at = Date.now();
        M2.artRefreshAttempted = false;
        writeCache(g2, data2);`;
  if (js.split(stamp).length !== 2) throw Error('meta.js loadMeta changed: update the stamp fix in export-collection-engine.mjs');
  writeFileSync(f, js.replace(stamp, `        M2.at = Date.now();
        M2.artRefreshAttempted = false;
        writeCache(g2, data2);
        M2.at = readCache()[g2]?.at || M2.at;`).replace(memo, `  var memo = (sig, fn) => {
    if (cache.has(sig)) return cache.get(sig);
    const keep = globalThis.__powerKeep, h = keep ? keep.hash(sig) : '';
    if (h) { const k = keep.get(h); if (k !== undefined) { cache.set(sig, k); return k; } }
    if (cache.size > 120) cache.clear();
    const v = fn();
    cache.set(sig, v);
    if (h) keep.put(h, v);
    return v;
  };`));
}

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
