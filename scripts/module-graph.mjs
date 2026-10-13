// Every module app.js loads up front (static imports, followed through), for <link rel="modulepreload">.
import fs from "node:fs";
export function moduleGraph(entry = "app.js", dir = ".") {
  const seen = new Set();
  const walk = (f) => {
    if (seen.has(f)) return;
    seen.add(f);
    let s;
    try { s = fs.readFileSync(`${dir}/${f}`, "utf8"); } catch { return; }
    for (const m of s.matchAll(/^\s*import\s[^;]*?from\s*["']\.\/([^"']+)["']/gm)) walk(m[1]);
    for (const m of s.matchAll(/^\s*import\s*["']\.\/([^"']+)["']/gm)) walk(m[1]);
  };
  walk(entry);
  return [...seen];
}
// node scripts/module-graph.mjs → rewrites the preload block in index.html.
if (import.meta.url === `file://${process.argv[1]}`) {
  const mods = moduleGraph().filter((m) => m !== "app.js").sort();
  const block = `<!-- modulepreload:start -->\n${mods.map((m) => `<link rel="modulepreload" href="${m}">`).join("\n")}\n<!-- modulepreload:end -->`;
  let html = fs.readFileSync("index.html", "utf8");
  html = /<!-- modulepreload:start -->[\s\S]*?<!-- modulepreload:end -->/.test(html)
    ? html.replace(/<!-- modulepreload:start -->[\s\S]*?<!-- modulepreload:end -->/, block)
    : html.replace('<script type="module" src="app.js"></script>', `${block}\n<script type="module" src="app.js"></script>`);
  fs.writeFileSync("index.html", html);
  console.log(`${mods.length} modules preloaded`);
}
