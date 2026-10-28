import { installNativeTransport, resolveNativeImage } from './native-transport.js';
import { createNativeAuth } from './native-auth.js';
import { createNativeArtworkStore } from './native-art-storage.js';
import { createNativeDocuments, installFileInputAdapter } from './native-documents.js';
import { OFFLINE_ART } from './offline-art-manifest.js';
import { installNativeDisplay } from './native-display.js';

if (location.origin !== 'https://android-integration.cardstashy.invalid') throw Error('This integration build must run in its own Android origin.');
Object.defineProperty(globalThis, 'CARDSTASHY_NATIVE', { value: Object.freeze({ platform: 'android', networkIntegrated: true }), writable: false });
Object.defineProperty(globalThis, 'CARDSTASHY_OFFLINE_ART', { value: Object.freeze(Object.fromEntries(OFFLINE_ART.map(entry => [entry.game + ':' + entry.cardId, Object.freeze({ full: entry.path, thumbnail: entry.thumbnail })]))), writable: false });

const banner = document.createElement('aside');
banner.id = 'native-integration-status'; banner.setAttribute('role', 'status');
// A start-up failure must say so instead of leaving the static "Loading your cards…" page.
const startupFailed = event => {
  if (document.querySelector('#gameTabs')?.children.length) return;
  const reason = event?.reason || event?.error || event;
  banner.hidden = false; banner.textContent = 'CardStashy could not start: ' + (reason?.message || String(reason || 'unknown error')) + '. Close and reopen the app; your saved cards are safe.';
};
addEventListener('error', startupFailed); addEventListener('unhandledrejection', startupFailed);
// Quiet until there is something to say (saves, sign-in links, link errors).
banner.hidden = true;
document.body.prepend(banner);
const plugin = globalThis.Capacitor?.registerPlugin?.('CardStashyPlatform');
if (!plugin) throw Error('The native document bridge is not installed.');
const documents = createNativeDocuments(plugin);
const artworkPlugin = globalThis.Capacitor.registerPlugin('CardStashyArtwork');
Object.defineProperty(globalThis, 'CARDSTASHY_ARTWORK_STORAGE', { value: createNativeArtworkStore(artworkPlugin), writable: false });
let bannerTimer;
const report = message => { banner.textContent = message; banner.hidden = false; clearTimeout(bannerTimer); bannerTimer = setTimeout(() => { banner.hidden = true; }, 6000); };
const authPlugin = globalThis.Capacitor.registerPlugin('CardStashyAuth');
// System haptics for the shared app's semantic events (feel.js prefers this over web vibration, never both).
const hapticsPlugin = globalThis.Capacitor.registerPlugin('CardStashyHaptics');
Object.defineProperty(globalThis, 'CARDSTASHY_HAPTICS', { value: Object.freeze({ perform: effect => { hapticsPlugin.perform({ effect: String(effect) }).catch(() => {}); }, cancel: () => { hapticsPlugin.cancel().catch(() => {}); } }), writable: false });
// The address an <img> actually loads, so shared code comparing image URLs sees the same value.
Object.defineProperty(globalThis, 'CARDSTASHY_IMAGE_URL', { value: value => { try { return resolveNativeImage(String(value), { enabled: true }) || String(value); } catch { return String(value); } }, writable: false });
installNativeTransport({ enabled: true, openExternal: options => authPlugin.openExternal(options), onError: report });
const nativeAuth = createNativeAuth({ plugin: authPlugin, storage: localStorage, enabled: true, report });
Object.defineProperty(globalThis, 'CARDSTASHY_NATIVE_AUTH', { value: nativeAuth, writable: false });

Object.defineProperty(globalThis, 'CARDSTASHY_DOCUMENTS', { value: Object.freeze({
  ...documents,
  saveDocument: async options => {
    report('Choose where to save the document.');
    try { const result = await documents.saveDocument(options); report(result.saved ? `Document saved · ${result.bytes} bytes.` : 'Save cancelled. Your cards and decks are unchanged.'); return result; }
    catch (error) { report('Document was not confirmed saved. ' + error.message); throw error; }
  },
}), writable: false });
installFileInputAdapter(documents, { onError: error => report('The file could not be opened. ' + error.message) });
await plugin.addListener('lifecycle', event => {
  if (!['foreground', 'background', 'memory-pressure'].includes(event.state)) return;
  if (event.state !== 'memory-pressure') document.documentElement.dataset.nativeAppState = event.state;
  globalThis.dispatchEvent(new CustomEvent('cardstashy-native-lifecycle', { detail: { state: event.state } }));
});
const displayPlugin = globalThis.Capacitor.registerPlugin('CardStashyDisplay');
installNativeDisplay({ plugin: displayPlugin });
// The launch splash stays up until the first screen has painted (Android lets it go after 5 s regardless).
try { await import('./app.js'); }
finally { requestAnimationFrame(() => requestAnimationFrame(() => { displayPlugin.ready().catch(() => {}); })); }
