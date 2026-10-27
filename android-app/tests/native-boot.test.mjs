import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(import.meta.dirname, '..');
// The Android bridge (native-bridge.js) only carries messages. Without @capacitor/core the
// entry module finds no Capacitor.registerPlugin and the app never leaves its static page.
test('the packaged page loads @capacitor/core before the native entry module', async () => {
  const html = await readFile(path.join(root, 'www/index.html'), 'utf8');
  const version = JSON.parse(await readFile(path.join(root, 'node_modules/@capacitor/core/package.json'), 'utf8')).version;
  const core = html.indexOf(`<script src="vendor/capacitor-core-${version}.js"></script>`), entry = html.indexOf('<script type="module" src="native-entry.js"></script>');
  assert.ok(core > 0 && entry > core, 'core script precedes native-entry.js');
  const bundled = await readFile(path.join(root, `www/vendor/capacitor-core-${version}.js`), 'utf8');
  assert.match(bundled, /registerPlugin=/);
  assert.equal(bundled, await readFile(path.join(root, `android/app/src/main/assets/public/vendor/capacitor-core-${version}.js`), 'utf8'));
});
test('a start-up failure is shown instead of the static loading page', async () => {
  const entry = await readFile(path.join(root, 'runtime/native-entry.js'), 'utf8');
  assert.match(entry, /addEventListener\('error', startupFailed\); addEventListener\('unhandledrejection', startupFailed\);/);
  assert.ok(entry.indexOf("addEventListener('error'") < entry.indexOf("registerPlugin"), 'listeners are installed before the first native lookup');
});
test('the packaged Wiki reader retains its pinned image CSP after Android sync', async () => {
  const html = await readFile(path.join(root, 'www/index.html'), 'utf8');
  const policy = html.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/)?.[1];
  assert.ok(policy, 'The packaged page has its native CSP');
  const images = policy.split(';').map(value => value.trim()).find(value => value.startsWith('img-src ')).split(/\s+/).slice(1);
  for (const location of ['https://files.mtg.wiki', 'https://archives.bulbagarden.net/media/upload/', 'https://static.wikia.nocookie.net/mtgsalvation_gamepedia/images/', 'https://static.wikia.nocookie.net/yugioh/images/']) assert.ok(images.includes(location), location);
  for (const broad of ['*', 'https:', 'https://static.wikia.nocookie.net', 'https://archives.bulbagarden.net']) assert.ok(!images.includes(broad), broad);
  const synced = await readFile(path.join(root, 'android/app/src/main/assets/public/index.html'), 'utf8');
  assert.equal(synced.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/)?.[1], policy, 'The Android asset carries exactly the built reader policy');
});
// Card art from /img/ loads from https://cardstashy.com in the app, not the page's own origin.
test('foil image matching uses the URL the app actually loads', async () => {
  const preview = await readFile(path.join(root, 'www/finish-preview.js'), 'utf8');
  assert.equal((preview.match(/globalThis\.CARDSTASHY_IMAGE_URL\?\./g) || []).length, 2, 'both sides of the foil image match use the app image URL');
  assert.match(await readFile(path.join(root, 'runtime/native-entry.js'), 'utf8'), /'CARDSTASHY_IMAGE_URL'/);
});
test('card art is served at the app origin by the native art cache, with the website routes only', async () => {
  const transport = await readFile(path.join(root, 'runtime/native-transport.js'), 'utf8');
  assert.match(transport, /const appImageURL = route => NATIVE_ORIGIN \+ route\.url\.slice\(SERVICE_ORIGIN\.length\);/);
  assert.doesNotMatch(transport, /crossorigin|cors=app/, 'no CORS workaround: same-origin art is readable');
  const client = await readFile(path.join(root, 'android/app/src/main/java/dev/cardstashy/integration/CardStashyWebViewClient.java'), 'utf8');
  assert.match(client, /"GET"\.equals\(request\.getMethod\(\)\)/); assert.match(client, /setInstanceFollowRedirects\(false\)/);
  const cache = await readFile(path.join(root, 'android/app/src/main/java/dev/cardstashy/integration/ImageCache.java'), 'utf8');
  const policy = await readFile(path.join(root, 'runtime/native-service-policy.js'), 'utf8');
  // Every website image route in the JS policy has its Java twin (same five patterns).
  // The Pokémon canonical-path check also starts with /img/ but is not a route.
  assert.equal((policy.replace(/const pokemon = pathname\.match\([^;]*;/, '').match(/\^\\\/img\\\//g) || []).length, 5); assert.equal((cache.match(/Pattern\.compile\("\^\/img\//g) || []).length, 5);
  assert.match(await readFile(path.join(root, 'android/app/src/main/java/dev/cardstashy/integration/MainActivity.java'), 'utf8'), /bridge\.setWebViewClient\(new CardStashyWebViewClient\(bridge\)\)/);
});
// Capacitor reports the status and navigation bars as --safe-area-inset-*; the phone layouts
// reset the top bar's padding-block and size pop-ups against the whole screen.
test('the top bar and pop-ups stay clear of the status bar', async () => {
  const css = await readFile(path.join(root, 'www/native-integration.css'), 'utf8'), site = await readFile(path.join(root, 'www/style.css'), 'utf8');
  assert.match(site, /\.topbar\{grid-template-columns:auto minmax\(0,1fr\) auto;gap:8px;padding-block:8px\}/, 'the phone rule this guards against is still in the website');
  assert.match(css, /@media \(max-width:1199px\) \{ html \.topbar \{ padding-top: calc\(max\(env\(safe-area-inset-top\), var\(--safe-area-inset-top, 0px\)\) \+ 8px\); \} \}/);
  for (const name of ['settings', 'profile-art', 'pack', 'community', 'tabletop', 'ai-review', 'ask']) {
    assert.match(css, new RegExp(`html \\.${name}-dialog:modal \\{ (max-height|height):`), `${name} dialog is capped to the safe area`);
    assert.ok((await readFile(path.join(root, 'shared-source', name === 'pack' ? 'sets-ui.css' : 'style.css'), 'utf8')).includes(`.${name}-dialog`), `${name} dialog still exists`);
  }
  assert.ok(site.indexOf('var(--safe-area-inset-top, 0px)') > 0, 'website env() insets also read the injected values');
});
// Play's engine runtime (~55 MB) stays on the website and its Forge host is not a native service, so the
// app relies on desktop-play.js keeping Play closed natively; only the Play modules the website serves ship.
test('Play stays web-only: its entry is closed in the app and its engine runtime is not packaged', async () => {
  const { readPlayDeviceEligibility, playDeviceGuardText } = await import(pathToFileURL(path.join(root, 'www/desktop-play.js')));
  const view = { Capacitor: { isNativePlatform: () => true }, navigator: { userAgent: 'Mozilla/5.0 (X11; Linux x86_64) Chrome/130.0.0.0', maxTouchPoints: 0 }, matchMedia: () => ({ matches: true }) };
  const result = readPlayDeviceEligibility(view, { documentElement: { clientWidth: 1600, clientHeight: 1000 } });
  assert.deepEqual([result.eligible, result.reason], [false, 'native']);
  assert.match(playDeviceGuardText(result), /Android app/);
  const experiments = JSON.parse(await readFile(path.join(root, 'bundle-manifest.json'), 'utf8')).files.map(file => file.path).filter(file => file.startsWith('experiments/'));
  assert.ok(experiments.includes('experiments/forge-proof/forge-session.mjs'));
  for (const file of experiments) assert.match(file, /^experiments\/(phase-engine|forge-proof)\/(?!test-)[a-z-]+\.(mjs|css)$/);
});
