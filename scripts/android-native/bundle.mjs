// The Android app packages the website's own files. A few are adapted by the reviewed native
// transforms below (copied verbatim from the Android build's scripts/ and applied in the same order
// as its build-web.mjs); every other shared file ships byte for byte. The release gate
// (scripts/verify-android-release.py) compares the APK against nativeBundleFile(path, source).
import { transformNativeAuth } from './transform-native-auth.mjs';
import { transformNativeScanner } from './transform-native-scanner.mjs';
import { transformNativeStorageApp, transformNativeStorageViews } from './transform-native-storage-settings.mjs';
import { transformNativeExports, transformNativeTcgExports } from './transform-native-exports.mjs';
import { transformNativeFoil } from './transform-native-foil.mjs';
import { transformNativePlaneswalk } from './transform-native-planeswalk.mjs';
import { compatColorMix } from './transform-native-compat-css.mjs';

const once = (text, from, to, what) => {
  if (text.split(from).length !== 2) throw Error(`Unexpected ${what} shape; review the native adapter.`);
  return text.replace(from, to);
};
// Android WebViews report the system bars through Capacitor's --safe-area-inset-* variables.
const insets = css => css.replace(/env\(safe-area-inset-(top|right|bottom|left)\)/g, (_, side) => `max(env(safe-area-inset-${side}), var(--safe-area-inset-${side}, 0px))`);

export const NATIVE_ADAPTED = ['app.js', 'tcg.js', 'cloud.js', 'artwork.js', 'finish-preview.js', 'foil-gl.js', 'views.js', 'scancam.js', 'planeswalk.html'];
export function nativeBundleFile(path, text) {
  // Safe-area insets, then color-mix() fallbacks for older WebViews (same order as build-web.mjs).
  if (path.endsWith('.css')) return compatColorMix(insets(text));
  switch (path) {
    case 'app.js': return transformNativeStorageApp(transformNativeExports(once(text, 'if ("serviceWorker" in navigator) {', 'if (!globalThis.CARDSTASHY_NATIVE && "serviceWorker" in navigator) {', 'service worker registration')));
    case 'tcg.js': return transformNativeTcgExports(text);
    case 'cloud.js': return transformNativeAuth(text);
    case 'artwork.js': return once(text, " const urls=c.game==='ptcg'?", " const offline=globalThis.CARDSTASHY_OFFLINE_ART?.[c.game+':'+c.id];\n const urls=offline?[large?offline.full:offline.thumbnail]:c.game==='ptcg'?", 'artwork resolver');
    case 'finish-preview.js': return once(once(text, 'actual=new URL(source,base);', 'actual=new URL(globalThis.CARDSTASHY_IMAGE_URL?.(source)??source,base);', 'finish image matcher'),
      'const expected=new URL(value,base);', 'const expected=new URL(globalThis.CARDSTASHY_IMAGE_URL?.(value)??value,base);', 'finish image matcher');
    case 'foil-gl.js': return transformNativeFoil(text);
    case 'views.js': return transformNativeStorageViews(text);
    case 'scancam.js': return transformNativeScanner(text);
    case 'planeswalk.html': return transformNativePlaneswalk(text);
    default: return text;
  }
}
// CLI for the release gate: prints {path: sha256} of the expected packaged bytes.
if (import.meta.url === `file://${process.argv[1]}`) {
  const { readFileSync } = await import('node:fs'), { createHash } = await import('node:crypto');
  const out = {};
  for (const path of JSON.parse(readFileSync(0, 'utf8'))) {
    const raw = readFileSync(path), text = path.endsWith('.css') || NATIVE_ADAPTED.includes(path) ? nativeBundleFile(path, raw.toString('utf8')) : null;
    out[path] = createHash('sha256').update(text === null ? raw : Buffer.from(text, 'utf8')).digest('hex');
  }
  console.log(JSON.stringify(out));
}
