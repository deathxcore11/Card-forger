import { transformNativeAuth } from './transform-native-auth.mjs';
import { transformNativeScanner } from './transform-native-scanner.mjs';
import { transformNativeStorageApp, transformNativeStorageViews } from './transform-native-storage-settings.mjs';
import { transformNativeExports, transformNativeTcgExports } from './transform-native-exports.mjs';
import { transformNativeFoil } from './transform-native-foil.mjs';
import { readFile, writeFile, mkdir, rm, copyFile, readdir, stat, rename } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { init, parse } from 'es-module-lexer';
import sharp from 'sharp';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.resolve(process.env.CARDSTASHY_SOURCE || path.join(root, 'shared-source'));
const output = path.join(root, 'www');
const baseline = JSON.parse(await readFile(path.join(root, 'source-baseline.json'), 'utf8'));
const expected = baseline.commit;
const snapshot = JSON.parse(await readFile(path.join(root, 'shared-source-manifest.json'), 'utf8'));
if (snapshot.commit !== expected || snapshot.version !== baseline.version) throw Error('Snapshot pin differs from reviewed baseline.');
for (const file of snapshot.files) {
  if (path.posix.normalize(file.path) !== file.path || file.path.startsWith('../') || path.isAbsolute(file.path)) throw Error('Unsafe snapshot path');
  const bytes = await readFile(path.join(source, file.path));
  if (bytes.length !== file.bytes || createHash('sha256').update(bytes).digest('hex') !== file.sha256) throw Error('Source snapshot integrity mismatch: ' + file.path);
}
const pkg = JSON.parse(await readFile(path.join(source, 'package.json')));
if (pkg.version !== baseline.version) throw Error('Source version differs from reviewed baseline.');
await init();
const sw = await readFile(path.join(source, 'sw.js'), 'utf8');
const literal = sw.match(/const ASSETS = (\[[\s\S]*?\n\]);/)?.[1];
if (!literal) throw Error('Shell asset list could not be parsed.');
const seeds = JSON.parse(literal.replace(/,\s*\]/g, ']')).filter(x => x !== './');
const extras = ['assets/cards/miscp-001.webp', 'assets/finishes/stamp-first-movie.png',
  'vendor/tesseract.min.js', 'vendor/worker.min.js', 'vendor/TESSERACT-LICENSE.txt', 'vendor/SUPABASE-LICENSE.txt',
  'scanidx/catalog-manifest.json', 'scanidx/TCGDEX-LICENSE.txt', 'rulebooks/manifest.json'];
for (const game of ['mtg', 'ptcg', 'ygo']) extras.push(`scanidx/${game}.bin`, `scanidx/${game}-ids.txt`, `scanidx/${game}-catalog-v1.json.gz`, `scanidx/${game}-signals-v1.json.gz`, `rulebooks/${game}-rules-v1.json.gz`);
// The tour lists WebM first and Android's WebView plays it, so the MP4 copies (for Safari) stay off the APK:
// they would only add ~1.9 MB and push the download past Cloudflare's 25 MiB per-file limit.
for (const name of ['collection', 'power', 'decks', 'ask', 'find']) for (const ext of ['webm', 'jpg']) extras.push(`tour/${name}.${ext}`);
// Real Magic booster sheets load from /data/mtg-boosters/<set>.json; the app ships them so packs open offline.
for (const file of await readdir(path.join(source, 'data/mtg-boosters')).catch(() => [])) if (/^[a-z0-9]{2,8}\.json$|^index\.json$/.test(file)) extras.push(`data/mtg-boosters/${file}`);
const ignored = (await readFile(path.join(source, '.assetsignore'), 'utf8')).split('\n').map(x => x.trim()).filter(x => x && !x.startsWith('#'));
const banned = file => /(^|\/)(\.|node_modules|tests?|scripts|review|supabase)(\/|$)/.test(file) || /(^|\/)(\.env|\.dev\.vars)/.test(file) || /\.(mjs|zip|patch|bundle|log)$/.test(file) || ['worker.js', 'sw.js', 'wrangler.jsonc', 'package.json'].includes(file) || ignored.includes(file);
const allowed = new Set();
const queue = [...seeds, ...extras];
while (queue.length) {
  let file = queue.shift().replace(/^\.\//, '');
  if (file.includes('?')) file = file.split('?')[0];
  file = path.posix.normalize(file);
  if (file.startsWith('../') || path.isAbsolute(file) || banned(file)) throw Error(`Unsafe frontend dependency: ${file}`);
  if (allowed.has(file)) continue;
  const info = await stat(path.join(source, file));
  if (!info.isFile()) throw Error(`Expected an explicit file: ${file}`);
  allowed.add(file);
  if (file.endsWith('.js')) {
    const code = await readFile(path.join(source, file), 'utf8');
    const [imports] = parse(code);
    for (const item of imports) if (item.specifier?.startsWith('.')) queue.push(path.posix.join(path.posix.dirname(file), item.specifier));
  }
  if (file.endsWith('.css')) {
    const code = await readFile(path.join(source, file), 'utf8');
    for (const match of code.matchAll(/url\(\s*['"]?([^)'"\s]+)['"]?\s*\)/g)) if (!/^(data:|https?:|\/\/|#)/.test(match[1])) queue.push(path.posix.join(path.posix.dirname(file), match[1]));
  }
}
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
for (const file of [...allowed].sort()) { await mkdir(path.dirname(path.join(output, file)), { recursive: true }); await copyFile(path.join(source, file), path.join(output, file)); }
// Android asset merging transparently unpacks files ending in .gz and strips the suffix.
// Preserve the original gzip bytes under .gzip, updating only native-bundle manifests.
for (const manifestFile of ['scanidx/catalog-manifest.json', 'rulebooks/manifest.json']) {
  const data = JSON.parse(await readFile(path.join(output, manifestFile), 'utf8'));
  const entries = manifestFile.startsWith('scanidx/') ? Object.values(data.games).flatMap(entry => [entry, entry.signals].filter(Boolean)) : Object.values(data);
  for (const entry of entries) {
    if (!entry.file.endsWith('.gz')) throw Error('Unexpected compressed-pack path; review native packaging.');
    const previous = entry.file;
    entry.file = previous.replace(/\.gz$/, '.gzip');
    await rename(path.join(output, previous), path.join(output, entry.file));
  }
  await writeFile(path.join(output, manifestFile), JSON.stringify(data) + '\n');
}
// The native app owns its packaged UI. No web SW takeover or cache repair in the native bundle.
let app = await readFile(path.join(output, 'app.js'), 'utf8');
const registration = 'if ("serviceWorker" in navigator) {';
if (app.split(registration).length !== 2) throw Error('Unexpected SW registration shape.');
app = app.replace(registration, 'if (!globalThis.CARDSTASHY_NATIVE && "serviceWorker" in navigator) {');
app = transformNativeExports(app);
app = transformNativeStorageApp(app);
await writeFile(path.join(output, 'app.js'), app);
await writeFile(path.join(output, 'tcg.js'), transformNativeTcgExports(await readFile(path.join(output, 'tcg.js'), 'utf8')));
const wrapperPkg = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
const publicConfig = await readFile(path.join(source, 'config.js'), 'utf8');
if (!/key: \"sb_publishable_[A-Za-z0-9_-]+\"/.test(publicConfig) || !publicConfig.includes('url: \"https://noxfmbwuytnbvfgukpiv.supabase.co\"')) throw Error('Expected pinned public-only Supabase config.');
// About shows the website version the app was built from and the app's own version.
const androidVersion = (await readFile(path.join(root, 'android/app/build.gradle'), 'utf8')).match(/versionName "([^"]+)"/)?.[1];
if (!androidVersion) throw Error('Android versionName not found.');
const versionLine = `export const APP_VERSION = ${JSON.stringify(pkg.version)};`;
if (!publicConfig.includes(versionLine)) throw Error('Website APP_VERSION differs from its package.json.');
await writeFile(path.join(output, 'config.js'), publicConfig.replace(versionLine, `export const APP_VERSION = ${JSON.stringify(pkg.version + ' · Android app ' + androidVersion)};`));
await writeFile(path.join(output, 'cloud.js'), transformNativeAuth(await readFile(path.join(output, 'cloud.js'), 'utf8')));

let html = await readFile(path.join(output, 'index.html'), 'utf8');
html = html.replace(/<link\b[^>]*href="https?:\/\/[^>]*>\s*/g, '');
html = html.replace('<title>CardStashy</title>', '<title>CardStashy Beta</title>');
// Capacitor's Android bridge only carries messages; registerPlugin comes from @capacitor/core,
// which must load (as a classic script) before the native entry module.
const capacitorCore = JSON.parse(await readFile(path.join(root, 'node_modules/@capacitor/core/package.json'), 'utf8'));
if (capacitorCore.version !== JSON.parse(await readFile(path.join(root, 'node_modules/@capacitor/android/package.json'), 'utf8')).version) throw Error('@capacitor/core and @capacitor/android versions differ.');
const coreFile = `vendor/capacitor-core-${capacitorCore.version}.js`;
await writeFile(path.join(output, coreFile), (await readFile(path.join(root, 'node_modules/@capacitor/core/dist/capacitor.js'), 'utf8')).replace(/\n\/\/# sourceMappingURL=.*\s*$/, '\n'));
html = html.replace('<script type="module" src="app.js"></script>', `<script src="${coreFile}"></script>\n<script type="module" src="native-entry.js"></script>`);
const watchdog = /<script>\s*\/\/ Start-up watchdog:[\s\S]*?<\/script>/;
if (!watchdog.test(html)) throw Error('Expected startup watchdog not found.');
html = html.replace(watchdog, '');
const csp = ["default-src 'self'", "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' https://cdn.jsdelivr.net/npm/", "style-src 'self' 'unsafe-inline'",
  // Exact provider hosts only; the native transport routes /api and /img to https://cardstashy.com.
  "img-src 'self' data: blob: https://cardstashy.com https://api.scryfall.com https://cards.scryfall.io https://svgs.scryfall.io https://assets.tcgdex.net https://images.pokemontcg.io https://images.ygoprodeck.com https://tcgplayer-cdn.tcgplayer.com https://images.scrydex.com https://r2.limitlesstcg.net https://limitlesstcg.nyc3.cdn.digitaloceanspaces.com https://img.yugioh-card.com https://pokesymbols.com https://media.wizards.com https://files.mtg.wiki https://archives.bulbagarden.net/media/upload/ https://static.wikia.nocookie.net/mtgsalvation_gamepedia/images/ https://static.wikia.nocookie.net/yugioh/images/",
  "font-src 'self'",
  "connect-src 'self' https://cardstashy.com https://noxfmbwuytnbvfgukpiv.supabase.co wss://noxfmbwuytnbvfgukpiv.supabase.co https://api.scryfall.com https://api.tcgdex.net https://api.pokemontcg.io https://db.ygoprodeck.com https://tcgcsv.com https://api.tickermint.cards https://mp-search-api.tcgplayer.com https://mtgjson.com https://raw.githubusercontent.com https://cdn.jsdelivr.net/npm/ https://cards.scryfall.io https://svgs.scryfall.io https://assets.tcgdex.net https://images.pokemontcg.io https://images.ygoprodeck.com",
  "worker-src 'self' blob:", "media-src 'self' blob:", "object-src 'none'", "frame-src 'none'", "form-action 'none'", "base-uri 'self'"].join('; ');
html = html.replace('<head>', `<head>\n<meta http-equiv="Content-Security-Policy" content="${csp}">\n<link rel="stylesheet" href="native-integration.css">`);
await writeFile(path.join(output, 'index.html'), html);
for (const file of await readdir(path.join(root, 'runtime'))) await copyFile(path.join(root, 'runtime', file), path.join(output, file));
// Android WebViews report the status and navigation bars through Capacitor's --safe-area-inset-*
// variables rather than env(), so the app uses whichever is larger and HUD buttons clear them.
let insetRewrites = 0;
for (const file of (await readdir(output)).filter(f => f.endsWith('.css'))) {
  const css = await readFile(path.join(output, file), 'utf8');
  const next = css.replace(/env\(safe-area-inset-(top|right|bottom|left)\)/g, (_, side) => { insetRewrites++; return `max(env(safe-area-inset-${side}), var(--safe-area-inset-${side}, 0px))`; });
  if (next !== css) await writeFile(path.join(output, file), next);
}
if (insetRewrites < 40) throw Error(`Expected the website's safe-area insets, found ${insetRewrites}.`);
// Deliberately separate opt-in artwork allowlist. Never copy tests/review directories wholesale.
const art = JSON.parse(await readFile(path.join(root, 'offline-art-sources.json'), 'utf8'));
if (art.schema !== 1 || art.sourceCommit !== expected || !Array.isArray(art.entries)) throw Error('Invalid artwork source manifest.');
const artIds = new Set(), artDestinations = new Set(), artEntries = [];
// Optional bulk artwork belongs in removable phone storage, not baked into this APK.
for (const entry of (process.env.CARDSTASHY_BUNDLE_STARTER_ART === '1' ? art.entries : [])) {
  if (entry.game !== 'ptcg' || !/^[a-zA-Z0-9._-]+$/.test(entry.cardId) || artIds.has(entry.cardId)) throw Error('Invalid/duplicate exact artwork identity.');
  artIds.add(entry.cardId);
  for (const image of [entry, entry.thumbnail].filter(Boolean)) {
    if (path.posix.normalize(image.source) !== image.source || image.source.startsWith('../') || path.isAbsolute(image.source) || !/\.(jpg|jpeg|png|webp)$/i.test(image.source)) throw Error('Invalid explicit artwork source.');
    if (!/^assets\/cards\/preloaded\/[a-zA-Z0-9._-]+\.(jpg|jpeg|png|webp)$/i.test(image.destination) || artDestinations.has(image.destination)) throw Error('Invalid/duplicate packaged artwork destination.');
    artDestinations.add(image.destination);
    const bytes = await readFile(path.join(source, image.source));
    if (bytes.length !== image.bytes || createHash('sha256').update(bytes).digest('hex') !== image.sha256) throw Error(`Artwork hash mismatch: ${image.source}`);
    await mkdir(path.dirname(path.join(output, image.destination)), { recursive: true });
    await writeFile(path.join(output, image.destination), bytes);
  }
  let thumbnail = entry.thumbnail?.destination;
  if (!thumbnail) {
    thumbnail = `assets/cards/preloaded/${entry.cardId}.thumb.webp`;
    if (artDestinations.has(thumbnail)) throw Error('Duplicate generated thumbnail path');
    artDestinations.add(thumbnail);
    // Build-time derivatives only: keep the full original and never upscale small retained scans.
    await sharp(path.join(source, entry.source)).resize({ width: 320, height: 448, fit: 'inside', withoutEnlargement: true }).webp({ quality: 78, effort: 4 }).toFile(path.join(output, thumbnail));
  }
  artEntries.push({ game: entry.game, cardId: entry.cardId, name: entry.displayName || entry.cardId, path: entry.destination, thumbnail, width: entry.width, height: entry.height, quality: entry.quality || '' });
}
await writeFile(path.join(output, 'offline-art-manifest.js'), 'export const OFFLINE_ART = ' + JSON.stringify(artEntries) + ';\n');
let artwork = await readFile(path.join(output, 'artwork.js'), 'utf8');
const artHook = " const urls=c.game==='ptcg'?";
if (artwork.split(artHook).length !== 2) throw Error('Unexpected artwork resolver shape; review native adapter.');
artwork = artwork.replace(artHook, " const offline=globalThis.CARDSTASHY_OFFLINE_ART?.[c.game+':'+c.id];\n const urls=offline?[large?offline.full:offline.thumbnail]:c.game==='ptcg'?");
await writeFile(path.join(output, 'artwork.js'), artwork);
// Foil maps match the shown picture by URL. Relative /img/ paths load from https://cardstashy.com
// in the app, so compare both sides as the native transport resolves them.
let finishPreview = await readFile(path.join(output, 'finish-preview.js'), 'utf8');
for (const [from, to] of [['actual=new URL(source,base);', 'actual=new URL(globalThis.CARDSTASHY_IMAGE_URL?.(source)??source,base);'], ['const expected=new URL(value,base);', 'const expected=new URL(globalThis.CARDSTASHY_IMAGE_URL?.(value)??value,base);']]) {
  if (finishPreview.split(from).length !== 2) throw Error('Unexpected finish image matcher; review native foil URL mapping.');
  finishPreview = finishPreview.replace(from, to);
}
await writeFile(path.join(output, 'finish-preview.js'), finishPreview);
await writeFile(path.join(output, 'foil-gl.js'), transformNativeFoil(await readFile(path.join(output, 'foil-gl.js'), 'utf8')));
await writeFile(path.join(output, 'views.js'), transformNativeStorageViews(await readFile(path.join(output, 'views.js'), 'utf8')));
await writeFile(path.join(output, 'scancam.js'), transformNativeScanner(await readFile(path.join(output, 'scancam.js'), 'utf8')));
const files = [];
async function record(dir = '') { for (const item of await readdir(path.join(output, dir), { withFileTypes: true })) { const file = path.posix.join(dir, item.name); if (item.isDirectory()) await record(file); else { const bytes = await readFile(path.join(output, file)); files.push({ path: file, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') }); } } }
await record();
const manifest = { source: 'https://github.com/deathxcore11/Card-forger', commit: expected, sourceVersion: pkg.version, appId: JSON.parse(await readFile(path.join(root, 'capacitor.config.json'), 'utf8')).appId, releaseReady: false, network: 'enabled-exact-hosts', syntheticDataOnly: false, offlineArt: { addedCardIdentities: artIds.size, packagedImageFiles: artDestinations.size, sourceManifest: 'offline-art-sources.json', removable: false, optionalStarterBundled: process.env.CARDSTASHY_BUNDLE_STARTER_ART === '1' }, sourceFiles: [...allowed].sort(), transformations: ['public Supabase config retained; native network enabled through exact-host CSP and transport', 'guard SW registration', 'remove repair watchdog', 'remove external font links', 'install exact-host CSP and native entry', 'exact-ID retained-art mapping; no synthetic seed'], files: files.sort((a,b) => a.path.localeCompare(b.path)) };
await writeFile(path.join(root, 'bundle-manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(`Built ${files.length} explicit frontend files (${files.reduce((n,x)=>n+x.bytes,0)} bytes) from ${expected}. Production source unchanged.`);
