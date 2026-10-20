// Recording harness for the welcome tour videos: a phone-sized real app with sample data.
import fs from "node:fs";
import { chromium } from "/opt/node22/lib/node_modules/playwright/index.mjs";
export const BASE = "http://localhost:8093/";
const seed = fs.readFileSync(new URL("./.seed.json", import.meta.url), "utf8");
// A visible touch dot for recordings: shows where each tap lands.
const TOUCH = `(() => { const css = document.createElement('style'); css.textContent = '.rec-dot{position:fixed;z-index:2147483647;width:34px;height:34px;margin:-17px 0 0 -17px;border-radius:50%;background:#ffffffd0;box-shadow:0 0 0 0 #ffffff99,0 2px 10px #0008;pointer-events:none;animation:rec-tap .55s ease-out forwards}@keyframes rec-tap{0%{transform:scale(.6);opacity:1;box-shadow:0 0 0 0 #fff9}60%{transform:scale(1);opacity:.95}100%{transform:scale(1.25);opacity:0;box-shadow:0 0 0 18px #fff0}}'; document.addEventListener('DOMContentLoaded', () => document.head.append(css)); window.__tap = (x, y) => { const d = document.createElement('i'); d.className = 'rec-dot'; d.style.left = x + 'px'; d.style.top = y + 'px'; document.documentElement.append(d); setTimeout(() => d.remove(), 700); }; })();`;
export async function launch({ video = null, state = seed, game = "mtg", width = 390, height = 760 } = {}) {
  const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
  const ctx = await b.newContext({ viewport: { width, height }, deviceScaleFactor: 2, colorScheme: "dark", serviceWorkers: "block", hasTouch: true, isMobile: true, ...(video ? { recordVideo: { dir: video, size: { width: width * 2, height: height * 2 } } } : {}) });
  await ctx.addInitScript(([s, g]) => { if (!localStorage.getItem("cardforge-v2")) { const st = JSON.parse(s); st.settings = { ...(st.settings || {}), game: g }; localStorage.setItem("cardforge-v2", JSON.stringify(st)); } localStorage.setItem("cardstashy-tour-v1", "done"); localStorage.setItem("cardstashy-guides-v2", JSON.stringify(["find", "save", "scan", "build", "tabletop"])); }, [state, game]);
  await ctx.addInitScript(TOUCH);
  // Card-data APIs are fetched from Node (through the sandbox proxy) and handed back with CORS.
  await ctx.route((u) => !/^(localhost|127\.)/.test(u.hostname) && !/\.(png|jpe?g|webp|gif|svg|woff2?)(\?|$)/.test(u.pathname) && !/format=image/.test(u.search), async (route) => {
    try { const r = await route.fetch(); return await route.fulfill({ response: r, headers: { ...r.headers(), "access-control-allow-origin": "*" } }); } catch { return route.abort().catch(() => {}); }
  });
  // Ask AI goes to the live app's server (same answer path as the deployed app).
  await ctx.route((u) => u.pathname.startsWith("/api/ai/"), async (route) => {
    const req = route.request(), LIVE = "https://cardforge2.deathxcore11.workers.dev";
    try { const r = await route.fetch({ url: LIVE + new URL(req.url()).pathname, headers: { ...req.headers(), origin: LIVE } }); return route.fulfill({ response: r }); } catch { return route.abort(); }
  });
  const page = await ctx.newPage();
  page.errs = []; page.on("pageerror", (e) => page.errs.push(e.message));
  // Tap = touch dot + real click.
  page.tap2 = async (sel, { wait = 650 } = {}) => { const el = page.locator(sel).first(); await el.waitFor({ state: 'visible', timeout: 20000 }); const moved = await el.evaluate((n) => { const r = n.getBoundingClientRect(); if (r.top >= 70 && r.bottom <= innerHeight - 90) return false; n.scrollIntoView({ behavior: 'smooth', block: 'center' }); return true; }); if (moved) await page.waitForTimeout(750); const bx = await el.boundingBox(); if (!bx) throw Error("no box " + sel); const x = bx.x + bx.width / 2, y = bx.y + bx.height / 2; await page.evaluate(([x, y]) => window.__tap?.(x, y), [x, y]); await page.waitForTimeout(180); await el.click(); await page.waitForTimeout(wait); };
  page.type2 = async (sel, text, delay = 85) => { await page.locator(sel).first().click(); for (const ch of text) { await page.keyboard.type(ch); await page.waitForTimeout(delay); } };
  return { b, ctx, page };
}
