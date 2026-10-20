// Records the welcome tour videos from the real app (tour/*.mp4, *.webm, *.jpg).
// 1. Serve the app: npx http-server -p 8093 -c-1 -s -P https://cardforge2.deathxcore11.workers.dev .
// 2. Sample data (real Scryfall cards): NODE_USE_ENV_PROXY=1 node scripts/record-tour/seed.mjs
// 3. Record:  node scripts/record-tour/record.mjs <find|collection|decks|power|ask|all>
// Needs Playwright with Chromium, and ffmpeg. Ask uses the live AI.
import fs from "node:fs"; import os from "node:os"; import { execFileSync } from "node:child_process";
import { launch, BASE } from "./harness.mjs";
const OUTDIR = process.argv[3] || new URL("../../tour", import.meta.url).pathname;
fs.mkdirSync(OUTDIR, { recursive: true });
const W = 390, H = 760;
const CLIPS = {
  async find(p) {
    await p.goto(BASE + "#home"); await p.waitForTimeout(5500); p.ready();
    await p.waitForTimeout(500);
    await p.tap2("#homeQ", { wait: 300 }); await p.type2("#homeQ", "Sol Ring", 110); await p.waitForTimeout(1400);
    await p.tap2("#home-result-1", { wait: 3800 });
    await p.tap2('[data-act="own"]', { wait: 1400 });
    const qty = p.locator('dialog[open] input[type="number"], .sheet input[type="number"]').first();
    if (await qty.count()) { await p.tap2('dialog[open] input[type="number"], .sheet input[type="number"]', { wait: 200 }); await qty.fill(""); await p.keyboard.type("2"); await p.waitForTimeout(700); }
    await p.tap2('[data-act="addSave"]', { wait: 3000 });
  },
  async collection(p) {
    await p.goto(BASE + "#collection/cards"); await p.waitForTimeout(4500);
    await p.locator('[aria-label="Gallery view"]').first().click(); await p.waitForTimeout(1800); p.ready();
    await p.waitForTimeout(700);
    await p.mouse.wheel(0, 420); await p.waitForTimeout(1200); await p.mouse.wheel(0, 420); await p.waitForTimeout(1200);
    await p.evaluate(() => scrollTo({ top: 0, behavior: "smooth" })); await p.waitForTimeout(800);
    await p.tap2('button:has-text("Value")', { wait: 2300 });
    await p.tap2('button:has-text("Binders")', { wait: 1500 });
    await p.tap2('text=Rare Treasures', { wait: 2600 });
  },
  async decks(p) {
    await p.goto(BASE + "#decks"); await p.waitForTimeout(4000); p.ready();
    await p.waitForTimeout(600);
    await p.tap2('[data-act="decksTab"]:has-text("Meta decks")', { wait: 3500 });
    await p.mouse.wheel(0, 300); await p.waitForTimeout(1300);
    const open = p.locator('[data-act="mtgProven"], [data-act="tMetaDeck"]').first();
    if (await open.count()) {
      await p.tap2('[data-act="mtgProven"], [data-act="tMetaDeck"]', { wait: 1200 }); const t = p.at();
      await p.waitForFunction(() => !/Fitting the tournament deck|Loading card data/i.test(document.body.innerText), null, { timeout: 60000 }).catch(() => {});
      p.cut(t, p.at() - 0.2); await p.waitForTimeout(1200);
      for (let i = 0; i < 2; i++) { await p.mouse.wheel(0, 300); await p.waitForTimeout(1100); }
    }
  },
  async power(p) {
    await p.goto(BASE + "#deck/kinnan/engine"); await p.waitForTimeout(5000); p.ready();
    await p.waitForTimeout(800);
    await p.waitForTimeout(600); await p.mouse.wheel(0, 300); await p.waitForTimeout(900); await p.mouse.wheel(0, 260); await p.waitForTimeout(2600);
  },
  async ask(p) {
    await p.goto(BASE + "#search"); await p.waitForTimeout(4000); p.ready();
    await p.waitForTimeout(500);
    await p.tap2('[data-act="askOpen"]', { wait: 900 });
    await p.type2(".ask-input", "What's the most competitive Modern deck?", 55); await p.waitForTimeout(300);
    await p.keyboard.press("Enter"); const think = p.at() + 2.2;
    await p.waitForSelector(".ask-item, .ask-msg.ai:not(.thinking)", { timeout: 60000 }).catch(() => {});
    p.cut(think, p.at() - 0.3);
    await p.waitForTimeout(3200);
  },
};
const name = process.argv[2];
if (name === "all") { for (const c of Object.keys(CLIPS)) execFileSync(process.execPath, [new URL(import.meta.url).pathname, c, OUTDIR], { stdio: "inherit" }); process.exit(0); }
const { b, ctx, page } = await launch({ width: W, height: H });
// Chrome's screencast delivers frames at the device pixel ratio (sharp text), each with a wall-clock timestamp.
const cdp = await ctx.newCDPSession(page), frames = [];
cdp.on("Page.screencastFrame", async (f) => { frames.push({ ts: f.metadata.timestamp, data: f.data }); await cdp.send("Page.screencastFrameAck", { sessionId: f.sessionId }).catch(() => {}); });
await cdp.send("Page.startScreencast", { format: "jpeg", quality: 90, maxWidth: W * 2, maxHeight: H * 2, everyNthFrame: 1 });
const now = () => Date.now() / 1000;
let start = 0; const cuts = []; page.ready = () => { start = now(); }; page.at = now; page.cut = (a, b) => { if (b > a) cuts.push([a, b]); };
await CLIPS[name](page);
const end = now();
await cdp.send("Page.stopScreencast").catch(() => {});
await ctx.close(); await b.close();
// Keep frames in [start, end] outside the cuts; shift times to close the gaps.
const cutBefore = (t) => cuts.reduce((n, [a, b2]) => n + Math.max(0, Math.min(t, b2) - a), 0);
let kept = frames.filter((f) => f.ts <= end && !cuts.some(([a, b2]) => f.ts > a && f.ts < b2)).map((f) => ({ ...f, t: f.ts - start - cutBefore(f.ts) }));
const before = kept.filter((f) => f.t < 0).pop(); kept = kept.filter((f) => f.t >= 0); if (before) kept.unshift({ ...before, t: 0 });
const total = end - start - cuts.reduce((n, [a, b2]) => n + (b2 - a), 0);
const dir = fs.mkdtempSync(os.tmpdir() + "/tour-frames-");
let list = "ffconcat version 1.0\n";
kept.forEach((f, i) => { const file = `${dir}/${String(i).padStart(5, "0")}.jpg`; fs.writeFileSync(file, Buffer.from(f.data, "base64")); const dur = (kept[i + 1]?.t ?? total) - f.t; list += `file '${file}'\nduration ${Math.max(0.001, dur).toFixed(3)}\n`; });
list += `file '${dir}/${String(kept.length - 1).padStart(5, "0")}.jpg'\n`;
fs.writeFileSync(`${dir}/list.txt`, list);
const mp4 = `${OUTDIR}/${name}.mp4`, webm = `${OUTDIR}/${name}.webm`, poster = `${OUTDIR}/${name}.jpg`;
const vf = "fps=30,scale=540:-2:flags=lanczos,format=yuv420p";
execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", `${dir}/list.txt`, "-vf", vf, "-c:v", "libx264", "-preset", "slow", "-crf", "27", "-movflags", "+faststart", "-an", mp4]);
execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", mp4, "-c:v", "libvpx-vp9", "-b:v", "0", "-crf", "36", "-row-mt", "1", "-an", webm]);
execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-ss", "0.2", "-i", mp4, "-frames:v", "1", "-q:v", "4", poster]);
fs.rmSync(dir, { recursive: true, force: true });
console.log(name, `${total.toFixed(1)}s`, `${kept.length} frames`, `mp4 ${(fs.statSync(mp4).size / 1024).toFixed(0)} KB`, `webm ${(fs.statSync(webm).size / 1024).toFixed(0)} KB`, page.errs.slice(0, 2));
