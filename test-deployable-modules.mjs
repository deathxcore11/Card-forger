// Every module the site can load in a browser must be served. .assetsignore hides *.mjs
// unless a module is listed with "!", so a new module that is imported but not listed
// is a 404 in production and the page that needs it cannot load (4.2.6 shipped one for
// two minutes). This follows static and dynamic imports from the site's entry points
// and checks each against .assetsignore the way the deploy reads it.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const glob = (p) => new RegExp("^" + p.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*\*/g, "\u0000").replace(/\*/g, "[^/]*").replace(/\?/g, "[^/]").replace(/\u0000/g, ".*") + "$");
const rules = fs.readFileSync(".assetsignore", "utf8").split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("#"))
  .map((l) => { const negate = l.startsWith("!"), pattern = (negate ? l.slice(1) : l).replace(/^\//, "").replace(/\/$/, ""); return { negate, pattern, re: glob(pattern), anchored: pattern.includes("/") }; });
// gitignore-style: the last matching rule wins; a rule without "/" matches any path segment.
export function ignored(file) {
  const parts = file.split("/");
  let out = false;
  for (const r of rules) {
    const hit = r.anchored
      ? parts.some((_, i) => r.re.test(parts.slice(0, i + 1).join("/")))
      : parts.some((seg) => r.re.test(seg));
    if (hit) out = !r.negate;
  }
  return out;
}

const imports = (file, src) => {
  const out = [];
  const add = (spec) => { if (/^\.\.?\//.test(spec)) out.push(path.posix.normalize(path.posix.join(path.posix.dirname(file), spec))); };
  for (const m of src.matchAll(/^\s*(?:import|export)\s[^;]*?from\s*["']([^"']+)["']/gm)) add(m[1]);
  for (const m of src.matchAll(/^\s*import\s*["']([^"']+)["']/gm)) add(m[1]);
  for (const m of src.matchAll(/\bimport\(\s*["'`]([^"'`$]+)["'`]\s*\)/g)) add(m[1]);
  return out;
};
const entries = new Set(["app.js", "sw.js"]);
for (const m of fs.readFileSync("index.html", "utf8").matchAll(/<script[^>]*type="module"[^>]*src="([^"]+)"/g)) entries.add(m[1].replace(/^\.?\//, ""));
const seen = new Set(), missing = [];
const walk = (file) => {
  if (seen.has(file)) return;
  seen.add(file);
  let src;
  try { src = fs.readFileSync(file, "utf8"); } catch { missing.push(file); return; }
  for (const dep of imports(file, src)) walk(dep);
};
for (const e of entries) walk(e);

const hidden = [...seen].filter((f) => !missing.includes(f) && ignored(f)).sort();
assert.deepEqual(missing.filter((f) => !f.startsWith("http")), [], "every imported module exists");
assert.deepEqual(hidden, [], "every module a browser can import is served, not hidden by .assetsignore (add a ! line for it)");
assert.ok(seen.size > 100, "the walk reaches the app's modules");
// The matcher itself: the 4.2.6 near miss would have been caught.
assert.equal(ignored("experiments/forge-proof/some-new-module.mjs"), true, "an unlisted .mjs is hidden");
assert.equal(ignored("worker.js"), true, "server-only files stay hidden");
assert.equal(ignored("app.js"), false);
console.log(`PASS: all ${seen.size} browser-reachable modules are served by the deploy.`);
