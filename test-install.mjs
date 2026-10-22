// Install nudge: only for people using the app, on browsers that can install, not when installed.
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import {esc} from "./ui.js";
globalThis.localStorage = { m: {}, getItem(k) { return this.m[k] ?? null; }, setItem(k, v) { this.m[k] = String(v); } };
const events = new Map();
globalThis.addEventListener = (type, fn) => events.set(type, fn);
const { shouldNudge, isIOS, installGuide, installHelpMarkup, promptInstall, canPrompt } = await import("./install.js");
assert.equal(shouldNudge({ copies: 0, state: { visits: 1 }, installed: false, prompt: true, ios: false }), false, "first visit, nothing saved: no nudge");
assert.equal(shouldNudge({ copies: 3, state: { visits: 1 }, installed: false, prompt: true, ios: false }), true, "cards saved: nudge");
assert.equal(shouldNudge({ copies: 0, state: { visits: 2 }, installed: false, prompt: false, ios: true }), true, "second visit on iPhone: Share-menu nudge");
assert.equal(shouldNudge({ copies: 5, state: { visits: 9 }, installed: true, prompt: true, ios: false }), false, "already installed");
assert.equal(shouldNudge({ copies: 5, state: { visits: 9, dismissedAt: Date.now() }, installed: false, prompt: true, ios: false }), false, "Not now is respected");
assert.equal(shouldNudge({ copies: 5, state: { visits: 9 }, installed: false, prompt: false, ios: false }), false, "browser can't install: nothing to show");
assert.equal(isIOS("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)"), true);
assert.equal(isIOS("Mozilla/5.0 (Linux; Android 14)"), false);
console.log("PASS: install nudge only when it can help.");
const edge = installGuide('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/140.0 Safari/537.36 Edg/140.0', false);
assert.match(edge.title,/Edge/);assert.match(edge.steps.join(' '),/More tools → Apps → Install this site as an app/);
assert.doesNotMatch(edge.steps.join(' '),/Add to Home screen/,'desktop help never gives Android-only instructions');
assert.match(installGuide('Mozilla/5.0 Chrome/140.0 Safari/537.36',false).steps.join(' '),/Cast, save and share/);
assert.match(installGuide('Mozilla/5.0 Android 14 Chrome/140.0',false).title,/Android/);
assert.match(installGuide('Mozilla/5.0 iPhone',false).title,/iPhone/);
assert.match(installGuide('',true).title,/running as an app/);
assert.doesNotMatch(installHelpMarkup({steps:['<script>alert(1)</script>']}),/<script>/,'help content is escaped');
let prompts=0,prevented=0;
events.get('beforeinstallprompt')({preventDefault(){prevented++;},prompt(){prompts++;return Promise.resolve();},userChoice:Promise.resolve({outcome:'dismissed'})});
assert(canPrompt());assert.equal(await promptInstall(),true);assert.equal(await promptInstall(),false);assert.equal(prompts,1);assert.equal(prevented,1);
assert(!localStorage.m['cardstashy-install-v1'].includes('"installed":true'),'dismissal is never saved as an install');
events.get('beforeinstallprompt')({preventDefault(){},prompt(){throw Error('stale event')},userChoice:Promise.resolve()});
assert.equal(await promptInstall(),false,'a rejected native prompt falls back to usable instructions');assert(!canPrompt());
events.get('beforeinstallprompt')({preventDefault(){},prompt(){return Promise.resolve()},userChoice:Promise.resolve({outcome:'accepted'})});
assert.equal(await promptInstall(),true);assert.equal(JSON.parse(localStorage.m['cardstashy-install-v1']).installed,true);
console.log('PASS: desktop/mobile/installed instructions, escaped help, single-use native install, dismissal, stale-prompt recovery and acceptance.');
// Exercise the actual button action that previously displayed phone-only text.
const source=fs.readFileSync('app.js','utf8'),sheets=[];
let offered=false,paints=0;
const ctx=vm.createContext({A:{},S:{ui:{view:'settings'}},promptInstall:async()=>offered,installGuide:()=>edge,installHelpMarkup,esc,openSheet:(html,context)=>sheets.push({html,context}),render:()=>paints++});
vm.runInContext(source.slice(source.indexOf('A.install = async'),source.indexOf('// Price alerts (all games).')),ctx);
await ctx.A.install();assert.equal(sheets.length,1);assert.equal(sheets[0].context.type,'install-help');assert.match(sheets[0].html,/Install this site as an app/);assert.doesNotMatch(sheets[0].html,/Add to Home screen/);assert.equal(paints,0);
offered=true;ctx.S.ui.view='home';await ctx.A.install();assert.equal(sheets.length,1,'native prompts never open a second help overlay');assert.equal(paints,1);
console.log('PASS: real Install action opens desktop help when the native prompt is unavailable, preserves Settings, and avoids duplicate dialogs.');
// Android beta download: the Settings link, the served file, its checksum and the app-link fingerprint agree.
{
  const { ANDROID_BETA, installCardMarkup } = await import("./install.js");
  const { ANDROID_APPS } = await import("./worker.js");
  const { createHash } = await import("node:crypto");
  const file = "." + ANDROID_BETA.href, apk = fs.readFileSync(file), meta = JSON.parse(fs.readFileSync(file.replace(/\.apk$/, ".json"), "utf8"));
  assert.equal(apk.length, ANDROID_BETA.bytes); assert.ok(apk.length < 25 * 1048576, "Cloudflare serves files up to 25 MiB");
  const sha = createHash("sha256").update(apk).digest("hex");
  assert.equal(sha, ANDROID_BETA.sha256); assert.equal(meta.sha256, sha); assert.equal(meta.bytes, apk.length);
  assert.equal(fs.readFileSync(file + ".sha256", "utf8"), `${sha}  ${file.split("/").pop()}\n`);
  const app = ANDROID_APPS.find(a => a.package === meta.package);
  assert.deepEqual(app?.sha256, [meta.signingCertificateSha256], "assetlinks names the beta's signing certificate");
  assert.ok(ANDROID_APPS.some(a => a.package === "dev.workers.deathxcore11.cardforge2.twa"), "the earlier TWA entry stays");
  // Android phones: the app download replaces the home-screen install as the main action.
  const android = installCardMarkup("", { ua: "Mozilla/5.0 (Linux; Android 14; Pixel 8) Chrome/141.0 Mobile Safari/537.36", nativeApp: false });
  assert.match(android, /Get the Android app/); assert.ok(android.includes(`<a class="btn" href="${ANDROID_BETA.href}" download>`)); assert.match(android, new RegExp(sha));
  assert.doesNotMatch(android, /<button class="btn" data-act="install">/, "the shortcut install is secondary on Android");
  // Computers and iPhone keep the home-screen install and never see the APK.
  for (const ua of ["Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/141.0 Safari/537.36", "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Safari/605.1"]) {
    const other = installCardMarkup("", { ua, nativeApp: false });
    assert.match(other, /Install CardStashy/); assert.match(other, /data-act="install"/); assert.doesNotMatch(other, /\.apk/);
  }
  // Inside the Android app there is nothing to install.
  assert.doesNotMatch(installCardMarkup("", { ua: "Android", nativeApp: true }), /\.apk|data-act="install"/);
  const sw = fs.readFileSync("./sw.js", "utf8");
  assert.match(sw, /url\.pathname\.startsWith\("\/downloads\/"\)\) return;/, "downloads bypass the service worker");
  assert.doesNotMatch(sw.slice(0, sw.indexOf("];")), /downloads|\.apk/, "the APK is never precached");
  // A Settings page cached before an update links an APK that is gone: the Worker (which only sees
  // missing files) forwards it to the current one instead of a failed download.
  const worker = (await import("./worker.js")).default;
  const hit = async (p, method = "GET") => worker.fetch(new Request("https://cardstashy.com" + p, { method }), { ASSETS: { fetch: () => new Response("asset") } }, {});
  for (const old of ["/downloads/cardstashy-android-beta-0.3.1.apk", "/downloads/cardstashy-android-beta-0.3.2.apk"]) {
    const r = await hit(old);assert.equal(r.status, 302, old);assert.equal(r.headers.get("Location"), ANDROID_BETA.href);assert.equal(r.headers.get("Cache-Control"), "no-store");
  }
  assert.equal((await hit("/downloads/cardstashy-android-beta-0.3.2.apk", "HEAD")).status, 302);
  for (const other of ["/downloads/cardstashy-android-beta-0.3.2.json", "/downloads/other.apk", "/downloads/cardstashy-android-beta-x.apk"]) assert.notEqual((await hit(other)).status, 302, other);
  assert.equal((await hit("/downloads/cardstashy-android-beta-0.3.2.apk", "POST")).status === 302, false);
  console.log("PASS: Android beta download matches its checksum and app-link fingerprint; links to earlier APKs forward to the current one.");
}
