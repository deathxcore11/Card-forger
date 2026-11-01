// Crash and error capture for the app and Planeswalk. Catches uncaught errors and rejected
// promises and sends each distinct one, once per page load, to Supabase (log_client_error).
// Keeps a short trail of the last taps so a report says what the player was doing.
// Sends no account data; fails quietly when offline or before the migration is run.
import { SUPABASE, APP_VERSION } from "./config.js";

const MAX_PER_PAGE = 5, TRAIL = 20;
const app = /planeswalk/i.test(location.pathname) ? "planeswalk" : "app";
const platform = window.Capacitor?.isNativePlatform?.() ? "android" : "web";
const trail = [], sent = new Set();
const IGNORE = /ResizeObserver loop|^Script error\.?$|AbortError|The user aborted|Load failed|NetworkError|Failed to fetch/i;

const label = el => {
  const t = el.closest?.("button,a,[data-act],[role=button],.card,.unit,.node,section") || el;
  const id = t.id ? "#" + t.id : "", act = t.dataset?.act ? `[${t.dataset.act}]` : "";
  const cls = !id && !act && typeof t.className === "string" && t.className ? "." + t.className.trim().split(/\s+/)[0] : "";
  const text = (t.getAttribute?.("aria-label") || t.textContent || "").replace(/\s+/g, " ").trim().slice(0, 24);
  return `${t.tagName?.toLowerCase() || "?"}${id}${act}${cls}${text ? " " + text : ""}`;
};
const note = what => { trail.push({ t: Math.round(performance.now()), w: String(what).slice(0, 60) }); if (trail.length > TRAIL) trail.shift(); };
addEventListener("pointerdown", e => { try { note(label(e.target)); } catch {} }, { capture: true, passive: true });
addEventListener("hashchange", () => note("nav " + location.hash.slice(0, 40)));

const screen = () => {
  try {
    if (typeof window.csErrorScreen === "function") return String(window.csErrorScreen()).slice(0, 120);
    const s = document.querySelector("#app > section.screen, #app > section, main [data-view]:not([hidden])");
    const cls = s && typeof s.className === "string" ? s.className.trim().replace(/\s+/g, ".") : "";
    return (location.pathname.split("/").pop() || "index") + location.hash.slice(0, 40) + (cls ? " " + cls : "");
  } catch { return ""; }
};

function report(message, stack) {
  message = String(message || "Unknown error").slice(0, 500);
  stack = String(stack || "").slice(0, 4000);
  if (IGNORE.test(message) || /(chrome|moz|safari)-extension:/.test(stack)) return;
  const key = message + stack.slice(0, 200);
  if (sent.has(key) || sent.size >= MAX_PER_PAGE || !SUPABASE.url || !SUPABASE.key) return;
  sent.add(key);
  const body = { app, version: APP_VERSION, platform, screen: screen(), message, stack, trail: trail.slice(), device: `${innerWidth}x${innerHeight}@${devicePixelRatio} ${navigator.userAgent}`.slice(0, 200) };
  try {
    fetch(SUPABASE.url + "/rest/v1/rpc/log_client_error", {
      method: "POST", keepalive: true,
      headers: { apikey: SUPABASE.key, Authorization: "Bearer " + SUPABASE.key, "Content-Type": "application/json" },
      body: JSON.stringify({ p: body }),
    }).catch(() => {});
  } catch {}
}

addEventListener("error", e => {
  if (e.target && e.target !== window) return; // a failed image or script load, not a crash
  report(e.message, e.error?.stack || `${e.filename || ""}:${e.lineno || 0}:${e.colno || 0}`);
});
addEventListener("unhandledrejection", e => {
  const r = e.reason;
  report(r?.message || r, r?.stack || "");
});

// For code that catches its own errors but still wants them seen, and for extra trail steps.
window.csErrors = { report: (err, where = "") => report((where ? where + ": " : "") + (err?.message || err), err?.stack || ""), note };
