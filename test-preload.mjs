// Every module the app loads up front is preloaded in index.html (fast first load); none missing.
import assert from "node:assert/strict";
import fs from "node:fs";
import { moduleGraph } from "./scripts/module-graph.mjs";
const html = fs.readFileSync("index.html", "utf8");
const pre = new Set([...html.matchAll(/rel="modulepreload" href="([^"]+)"/g)].map((m) => m[1]));
const missing = moduleGraph().filter((m) => m !== "app.js" && !pre.has(m));
assert.deepEqual(missing, [], "run: node scripts/module-graph.mjs");
for (const m of pre) assert.ok(fs.existsSync(m), `preloaded module exists: ${m}`);
console.log(`PASS: ${pre.size} modules preloaded.`);
const sw = fs.readFileSync("sw.js", "utf8");
assert.deepEqual(moduleGraph().filter((m) => !sw.includes(`"./${m}"`)), [], "every app module is in the service worker's offline list");
console.log("PASS: every app module cached for offline use.");
