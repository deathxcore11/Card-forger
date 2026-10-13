// Installing the app: a small nudge on Home once someone is actually using CardStashy (second
// visit, or cards saved), never when it's already installed or after "Not now".
import { esc } from "./ui.js";

const KEY = "cardstashy-install-v1";
let deferred = null;
const listeners = new Set();

const read = () => {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "{}") || {};
  } catch {
    return {};
  }
};
const write = (v) => {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...read(), ...v }));
  } catch {}
};

export const isInstalled = () => !!(globalThis.matchMedia?.("(display-mode: standalone)").matches || globalThis.navigator?.standalone);
export const isIOS = (ua = globalThis.navigator?.userAgent || "") => /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && (globalThis.navigator?.maxTouchPoints || 0) > 1);
export const canPrompt = () => !!deferred;
export const onInstallable = (fn) => listeners.add(fn);

globalThis.addEventListener?.("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferred = e;
  for (const fn of listeners) fn();
});
globalThis.addEventListener?.("appinstalled", () => {
  deferred = null;
  write({ installed: true });
});

// One visit per page load (this module runs once).
write({ visits: (read().visits || 0) + 1 });

export async function promptInstall() {
  if (!deferred) return false;
  deferred.prompt();
  const r = await deferred.userChoice.catch(() => null);
  deferred = null;
  if (r?.outcome === "accepted") write({ installed: true });
  return true;
}
export const dismissInstall = () => write({ dismissedAt: Date.now() });

// Who sees the nudge: not installed, not dismissed in the last 30 days, used the app before or
// saved cards, and on a browser that can install (the prompt, or iPhone/iPad Safari's Share menu).
export function shouldNudge({ copies = 0, state = read(), installed = isInstalled(), prompt = canPrompt(), ios = isIOS() } = {}) {
  if (installed || state.installed) return false;
  if (state.dismissedAt && Date.now() - state.dismissedAt < 30 * 864e5) return false;
  if ((state.visits || 0) < 2 && !copies) return false;
  return prompt || ios;
}

const SHARE = `<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v12M8 7l4-4 4 4"/><path d="M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1"/></svg>`;
export function installNudge(copies = 0) {
  if (!shouldNudge({ copies })) return "";
  const body = canPrompt()
    ? `<p>Open it from your home screen like any app. Your collection works offline.</p><div class="actions"><button class="btn small" data-act="install">Install</button><button class="link small" data-act="installLater">Not now</button></div>`
    : `<p>Tap ${SHARE} <b>Share</b> in Safari, then <b>Add to Home Screen</b>. Your collection works offline.</p><div class="actions"><button class="link small" data-act="installLater">Not now</button></div>`;
  return `<section class="install-nudge" aria-label="${esc("Install CardStashy")}"><img src="icon-192.png" alt="" width="44" height="44"><div><b>Keep CardStashy on your home screen</b>${body}</div></section>`;
}
